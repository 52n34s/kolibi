import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exerciseStubFromSessionSet } from '../../components/training/exercise-stub.ts';
import { resolveExerciseName } from '../workouts/exercise-name.ts';
import type { SessionSet } from '../workouts/types.ts';

const pullUpSet: SessionSet = {
  id: 'set-1',
  sessionId: 'session-1',
  userId: 'user-1',
  exerciseId: 'pull-up-id',
  exerciseName: 'Klimmzüge',
  exercisePosition: 0,
  setIndex: 0,
  kind: 'reps',
  perSide: false,
  targetReps: 3,
  targetRepsMax: 8,
  targetSeconds: null,
  targetSecondsMax: null,
  targetWeightKg: null,
  reps: 8,
  seconds: null,
  secondsOtherSide: null,
  weightKg: null,
  completedAt: '2026-09-25T10:00:00.000Z',
};

describe('exerciseStubFromSessionSet', () => {
  it('keeps the stored name when no catalog names are known', () => {
    const stub = exerciseStubFromSessionSet(pullUpSet);
    assert.equal(resolveExerciseName(stub, 'en'), 'Klimmzüge');
  });

  it('uses catalog names, so the thumb letter matches the translated row name', () => {
    const stub = exerciseStubFromSessionSet(pullUpSet, {
      de: 'Klimmzüge',
      en: 'Pull-ups',
      es: 'Dominadas',
    });
    assert.equal(resolveExerciseName(stub, 'en'), 'Pull-ups');
    assert.equal(resolveExerciseName(stub, 'es'), 'Dominadas');
    assert.equal(resolveExerciseName(stub, 'de'), 'Klimmzüge');
  });
});
