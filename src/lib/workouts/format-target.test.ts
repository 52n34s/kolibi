import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allSetsHitUpperBound, formatExerciseTarget } from './format-target.ts';

describe('formatExerciseTarget', () => {
  it('formats reps with and without a max', () => {
    assert.equal(
      formatExerciseTarget({ sets: 3, kind: 'reps', reps: 8, repsMax: 12 }),
      '3 × 8–12',
    );
    assert.equal(formatExerciseTarget({ sets: 3, kind: 'reps', reps: 8 }), '3 × 8');
  });

  it('formats seconds with and without a max', () => {
    assert.equal(
      formatExerciseTarget({ sets: 2, kind: 'time', seconds: 20, secondsMax: 40 }),
      '2 × 20–40 s',
    );
    assert.equal(formatExerciseTarget({ sets: 3, kind: 'time', seconds: 30 }), '3 × 30 s');
  });

  it('appends a per-side label when provided', () => {
    assert.equal(
      formatExerciseTarget({
        sets: 3,
        kind: 'time',
        seconds: 30,
        perSide: true,
        perSideLabel: 'pro Seite',
      }),
      '3 × 30 s pro Seite',
    );
  });
});

describe('allSetsHitUpperBound', () => {
  it('is true only when every set meets the max', () => {
    assert.equal(
      allSetsHitUpperBound({
        kind: 'reps',
        targetRepsMax: 12,
        targetSecondsMax: null,
        setValues: [12, 12, 12],
      }),
      true,
    );
    assert.equal(
      allSetsHitUpperBound({
        kind: 'reps',
        targetRepsMax: 12,
        targetSecondsMax: null,
        setValues: [12, 11, 12],
      }),
      false,
    );
  });

  it('is false without a max or sets', () => {
    assert.equal(
      allSetsHitUpperBound({
        kind: 'reps',
        targetRepsMax: null,
        targetSecondsMax: null,
        setValues: [10],
      }),
      false,
    );
  });
});
