import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestProgression, type ProgressionHistoryUnit } from './progression.ts';
import { withoutSession } from './progression-history.ts';
import type { Exercise } from './types.ts';

function exercise(partial: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  return {
    userId: null,
    catalogSlug: partial.id,
    names: { de: partial.id },
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 3,
    defaultRepsMax: 8,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: 'pull_vertical',
    ladderStep: 5,
    progressionKind: 'variant',
    timeCapSeconds: null,
    ...partial,
  };
}

function unit(sessionId: string, reps: number, intensity: 'normal' | 'hard'): ProgressionHistoryUnit {
  return {
    sessionId,
    intensity,
    sets: [reps, reps, reps].map((value) => ({
      reps: value,
      seconds: null,
      secondsOtherSide: null,
      targetReps: 3,
      targetRepsMax: 8,
      targetSeconds: null,
      targetSecondsMax: null,
      done: true,
    })),
  };
}

describe('withoutSession', () => {
  it('drops the rows of the given session and keeps the order of the rest', () => {
    const rows = [{ sessionId: 'now', n: 1 }, { sessionId: 'old', n: 2 }, { sessionId: 'now', n: 3 }];
    assert.deepEqual(withoutSession(rows, 'now'), [{ sessionId: 'old', n: 2 }]);
  });

  it('a hard session does not count as its own previous success', () => {
    const pullUp = exercise({ id: 'pull_up' });
    const archer = exercise({ id: 'archer_pull_up', ladderStep: 6 });
    const current = unit('now', 8, 'hard');
    const fetched = [unit('now', 8, 'normal'), unit('tue', 6, 'normal')];
    const input = {
      exercise: pullUp,
      ladder: [pullUp, archer],
      currentTarget: { targetSets: 3, targetReps: 3, targetRepsMax: 8, targetSeconds: null, targetSecondsMax: null },
      templateExerciseIds: [pullUp.id],
      lastEvents: [],
    };
    assert.notEqual(suggestProgression({ ...input, history: [current, ...fetched] }), null);
    assert.equal(
      suggestProgression({ ...input, history: [current, ...withoutSession(fetched, 'now')] }),
      null,
    );
  });
});
