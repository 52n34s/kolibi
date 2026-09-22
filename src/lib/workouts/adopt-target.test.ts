import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { adoptedUpperBound, adoptTargetFromMedian } from './adopt-target.ts';

describe('adoptedUpperBound', () => {
  it('keeps an upper bound that is still above the median', () => {
    assert.equal(adoptedUpperBound(10, 6), 10);
  });

  it('raises the upper bound to the median when the median passed it', () => {
    assert.equal(adoptedUpperBound(10, 14), 14);
  });

  it('collapses to a single value when the median equals the bound', () => {
    assert.equal(adoptedUpperBound(12, 12), 12);
  });

  it('leaves an absent upper bound absent', () => {
    assert.equal(adoptedUpperBound(null, 9), null);
    assert.equal(adoptedUpperBound(undefined, 9), null);
  });
});

describe('adoptTargetFromMedian', () => {
  it('adopts reps and keeps the range intact', () => {
    assert.deepEqual(
      adoptTargetFromMedian({ kind: 'reps', median: 6, targetRepsMax: 10, targetSecondsMax: null }),
      { targetReps: 6, targetRepsMax: 10, targetSeconds: null, targetSecondsMax: null },
    );
  });

  it('adopts seconds and keeps the range intact', () => {
    assert.deepEqual(
      adoptTargetFromMedian({ kind: 'time', median: 25, targetRepsMax: null, targetSecondsMax: 40 }),
      { targetReps: null, targetRepsMax: null, targetSeconds: 25, targetSecondsMax: 40 },
    );
  });

  it('raises the upper bound when the median overshoots it (reps)', () => {
    const next = adoptTargetFromMedian({
      kind: 'reps',
      median: 14,
      targetRepsMax: 10,
      targetSecondsMax: null,
    });
    assert.equal(next.targetReps, 14);
    assert.equal(next.targetRepsMax, 14);
  });

  it('raises the upper bound when the median overshoots it (time)', () => {
    const next = adoptTargetFromMedian({
      kind: 'time',
      median: 45,
      targetRepsMax: null,
      targetSecondsMax: 30,
    });
    assert.equal(next.targetSeconds, 45);
    assert.equal(next.targetSecondsMax, 45);
  });

  it('never produces min > max for any median / bound combination', () => {
    for (let bound = 1; bound <= 40; bound += 1) {
      for (let median = 0; median <= 60; median += 1) {
        const reps = adoptTargetFromMedian({
          kind: 'reps',
          median,
          targetRepsMax: bound,
          targetSecondsMax: null,
        });
        assert.ok(
          reps.targetRepsMax != null && reps.targetReps != null,
          'bounded input must stay bounded',
        );
        assert.ok(
          reps.targetReps <= reps.targetRepsMax,
          `reps inverted at median=${median} bound=${bound}`,
        );

        const time = adoptTargetFromMedian({
          kind: 'time',
          median,
          targetRepsMax: null,
          targetSecondsMax: bound,
        });
        assert.ok(
          time.targetSecondsMax != null && time.targetSeconds != null,
          'bounded input must stay bounded',
        );
        assert.ok(
          time.targetSeconds <= time.targetSecondsMax,
          `seconds inverted at median=${median} bound=${bound}`,
        );
      }
    }
  });

  it('rounds and clamps the median', () => {
    assert.equal(
      adoptTargetFromMedian({ kind: 'reps', median: 7.6, targetRepsMax: 12, targetSecondsMax: null })
        .targetReps,
      8,
    );
    assert.equal(
      adoptTargetFromMedian({ kind: 'reps', median: -3, targetRepsMax: 12, targetSecondsMax: null })
        .targetReps,
      0,
    );
  });
});
