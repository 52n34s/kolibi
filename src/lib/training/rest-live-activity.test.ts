import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ActiveExercise, ActiveSession } from '../workouts/types.ts';
import {
  nextSetOf,
  restLiveActivityContent,
  shouldVibrateOnRestEnd,
  type RestLiveActivityInput,
} from './rest-live-activity.ts';

const NOW = 1_700_000_000_000;

function t(key: string, options?: Record<string, unknown>): string {
  return options ? `${key}:${JSON.stringify(options)}` : key;
}

function exercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    exerciseId: 'ex-1',
    name: 'Kniebeuge',
    names: { de: 'Kniebeuge', en: 'Squat' },
    catalogSlug: 'squat',
    kind: 'reps',
    perSide: false,
    imageAsset: null,
    imagePath: null,
    note: null,
    targetSets: 4,
    targetReps: 8,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: null,
    addedInSession: false,
    skipped: false,
    sets: [0, 1, 2, 3].map((i) => ({
      id: `set-${i}`,
      value: 8,
      done: i < 2,
      completedAt: null,
      secondsOtherSide: null,
    })) as ActiveExercise['sets'],
    ...overrides,
  };
}

function session(
  overrides: Partial<Pick<ActiveSession, 'phase' | 'items' | 'cursor'>> = {},
): Pick<ActiveSession, 'phase' | 'items' | 'cursor'> {
  return {
    phase: 'active',
    items: [exercise()],
    cursor: { exerciseIndex: 0, setIndex: 2 },
    ...overrides,
  };
}

function input(overrides: Partial<RestLiveActivityInput> = {}): RestLiveActivityInput {
  return {
    timer: { status: 'running', endsAt: NOW + 60_000, remainingOnPause: null, durationSec: 90 },
    session: session(),
    sessionEnded: false,
    lang: 'en',
    now: NOW,
    t,
    ...overrides,
  };
}

describe('nextSetOf', () => {
  it('reads the open set at the cursor (1-based)', () => {
    assert.deepEqual(nextSetOf(session()), { exerciseIndex: 0, set: 3, sets: 4 });
  });

  it('is null without session, in the summary, or on a done set', () => {
    assert.equal(nextSetOf(null), null);
    assert.equal(nextSetOf(session({ phase: 'summary' })), null);
    assert.equal(nextSetOf(session({ cursor: { exerciseIndex: 0, setIndex: 0 } })), null);
    assert.equal(nextSetOf(session({ cursor: { exerciseIndex: 3, setIndex: 0 } })), null);
  });
});

describe('restLiveActivityContent', () => {
  it('running: hands the end date over, counting is up to the extension', () => {
    const content = restLiveActivityContent(input());
    assert.ok(content);
    assert.equal(content.isPaused, false);
    assert.equal(content.endMs, NOW + 60_000);
    assert.equal(content.startMs, NOW + 60_000 - 90_000);
    assert.equal(content.remainingText, '01:00');
    assert.equal(content.exerciseName, 'Squat');
    assert.equal(content.setLabel, 'liveActivity.nextSet:{"set":3,"sets":4}');
    assert.equal(content.title, 'liveActivity.title');
    assert.equal(content.pausedLabel, 'liveActivity.paused');
    assert.equal(content.doneLabel, 'liveActivity.done');
  });

  it('running after +30: the progress range never starts in the future', () => {
    const content = restLiveActivityContent(
      input({
        timer: { status: 'running', endsAt: NOW + 150_000, remainingOnPause: null, durationSec: 90 },
      }),
    );
    assert.equal(content?.startMs, NOW);
    assert.equal(content?.remainingText, '02:30');
  });

  it('paused: static remaining time, no dates', () => {
    const content = restLiveActivityContent(
      input({
        timer: { status: 'paused', endsAt: null, remainingOnPause: 45_000, durationSec: 90 },
      }),
    );
    assert.ok(content);
    assert.equal(content.isPaused, true);
    assert.equal(content.remainingText, '00:45');
    assert.equal(content.startMs, 0);
    assert.equal(content.endMs, 0);
    assert.equal(content.pausedProgress, 0.5);
  });

  it('paused content does not depend on the clock', () => {
    const timer = { status: 'paused' as const, endsAt: null, remainingOnPause: 45_000, durationSec: 90 };
    assert.deepEqual(
      restLiveActivityContent(input({ timer, now: NOW })),
      restLiveActivityContent(input({ timer, now: NOW + 10_000 })),
    );
  });

  it('without a session: timer only', () => {
    const content = restLiveActivityContent(input({ session: null }));
    assert.equal(content?.exerciseName, '');
    assert.equal(content?.setLabel, '');
  });

  it('ends for idle, finished and elapsed rests', () => {
    for (const timer of [
      { status: 'idle' as const, endsAt: null, remainingOnPause: null, durationSec: 90 },
      { status: 'finished' as const, endsAt: null, remainingOnPause: null, durationSec: 90 },
      { status: 'running' as const, endsAt: NOW - 1, remainingOnPause: null, durationSec: 90 },
      { status: 'paused' as const, endsAt: null, remainingOnPause: 0, durationSec: 90 },
    ]) {
      assert.equal(restLiveActivityContent(input({ timer })), null, timer.status);
    }
  });

  it('ends once the session is over or in its summary', () => {
    assert.equal(restLiveActivityContent(input({ sessionEnded: true })), null);
    assert.equal(restLiveActivityContent(input({ session: session({ phase: 'summary' }) })), null);
  });
});

describe('shouldVibrateOnRestEnd', () => {
  it('vibrates right at the end', () => {
    assert.equal(shouldVibrateOnRestEnd(NOW, NOW), true);
    assert.equal(shouldVibrateOnRestEnd(NOW, NOW + 900), true);
    assert.equal(shouldVibrateOnRestEnd(NOW, NOW - 500), true);
  });

  it('stays quiet long after the end or when the rest was cut short', () => {
    assert.equal(shouldVibrateOnRestEnd(NOW, NOW + 60_000), false);
    assert.equal(shouldVibrateOnRestEnd(NOW, NOW - 20_000), false);
    assert.equal(shouldVibrateOnRestEnd(null, NOW), false);
  });
});
