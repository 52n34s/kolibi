import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { newSessionBest } from './session-bests.ts';
import type { SessionSet } from './types.ts';

function set(sessionId: string, reps: number | null, seconds: number | null = null): SessionSet {
  return {
    id: `${sessionId}-${reps}-${seconds}`,
    sessionId,
    userId: 'u1',
    exerciseId: 'push_up',
    exerciseName: 'Liegestütze',
    exercisePosition: 0,
    setIndex: 0,
    kind: seconds != null ? 'time' : 'reps',
    perSide: false,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    reps,
    seconds,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: '2026-09-25T10:00:00.000Z',
  };
}

describe('newSessionBest', () => {
  // The running session's sets are synced before the summary loads the
  // history, so the session met itself and never showed a new best.
  it('shows a new best although the session sets are already in the history', () => {
    const history = [set('now', 12), set('now', 10), set('mon', 9), set('fri', 10)];
    assert.equal(
      newSessionBest({ values: [12, 10], history, kind: 'reps', sessionId: 'now' }),
      12,
    );
  });

  it('shows nothing when an earlier session was as good', () => {
    const history = [set('now', 12), set('mon', 12)];
    assert.equal(
      newSessionBest({ values: [12], history, kind: 'reps', sessionId: 'now' }),
      null,
    );
  });

  it('does not count a first execution as a best, with only its own sets in the history', () => {
    const history = [set('now', 7), set('now', 6)];
    assert.equal(
      newSessionBest({ values: [7, 6], history, kind: 'reps', sessionId: 'now' }),
      null,
    );
  });

  it('compares seconds for timed exercises', () => {
    const history = [set('now', null, 45), set('mon', null, 40)];
    assert.equal(
      newSessionBest({ values: [45], history, kind: 'time', sessionId: 'now' }),
      45,
    );
  });

  it('shows nothing without done sets', () => {
    assert.equal(
      newSessionBest({ values: [], history: [set('mon', 5)], kind: 'reps', sessionId: 'now' }),
      null,
    );
  });
});
