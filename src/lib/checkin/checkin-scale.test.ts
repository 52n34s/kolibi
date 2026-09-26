import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkinScaleLabelOrder,
  isReversedCheckinScale,
  toDisplayedCheckinValue,
  toStoredCheckinValue,
} from './checkin-scale.ts';
import { wellnessScore, type CheckinAnswers } from './readiness.ts';

const ALL_STEPS = [1, 2, 3, 4, 5] as const;

describe('checkin-scale', () => {
  it('only soreness and stress are reversed', () => {
    assert.equal(isReversedCheckinScale('sleep'), false);
    assert.equal(isReversedCheckinScale('energy'), false);
    assert.equal(isReversedCheckinScale('soreness'), true);
    assert.equal(isReversedCheckinScale('stress'), true);
  });

  it('label order always puts the good end on the right', () => {
    assert.deepEqual(checkinScaleLabelOrder('sleep'), ['low', 'high']);
    assert.deepEqual(checkinScaleLabelOrder('energy'), ['low', 'high']);
    assert.deepEqual(checkinScaleLabelOrder('soreness'), ['high', 'low']);
    assert.deepEqual(checkinScaleLabelOrder('stress'), ['high', 'low']);
  });

  it('sleep and energy save the displayed digit unchanged', () => {
    for (const question of ['sleep', 'energy']) {
      for (const displayed of ALL_STEPS) {
        assert.equal(toStoredCheckinValue(question, displayed), displayed);
        assert.equal(toDisplayedCheckinValue(question, displayed), displayed);
      }
    }
  });

  it('soreness and stress save 6 minus the displayed digit, so the right button is still good', () => {
    for (const question of ['soreness', 'stress']) {
      assert.equal(toStoredCheckinValue(question, 1), 5); // leftmost tap → old "very" value
      assert.equal(toStoredCheckinValue(question, 5), 1); // rightmost tap → old "barely" value
      assert.deepEqual(
        ALL_STEPS.map((displayed) => toStoredCheckinValue(question, displayed)),
        [5, 4, 3, 2, 1],
      );
    }
  });

  it('round-trips in both directions, including redisplaying an already-saved check-in', () => {
    for (const question of ['sleep', 'energy', 'soreness', 'stress']) {
      for (const value of ALL_STEPS) {
        // A tap saved and immediately reread shows the same button.
        assert.equal(toDisplayedCheckinValue(question, toStoredCheckinValue(question, value)), value);
        // A value stored before this change (or by the other conversion)
        // still redisplays as the button matching its original meaning.
        assert.equal(toStoredCheckinValue(question, toDisplayedCheckinValue(question, value)), value);
      }
    }
  });

  it('redisplaying a check-in saved before this change keeps the same meaning', () => {
    // A pre-existing row with soreness: 4 ("fairly sore", old high end) must
    // still highlight a button on the bad (left) side, not the good side.
    const displayed = toDisplayedCheckinValue('soreness', 4);
    assert.equal(displayed, 2);
    assert.ok(displayed < 3, 'a sore value must redisplay left of center');
  });

  it('the rightmost button for every question saves the best possible wellness score', () => {
    // Regression guard: the button that ends up on the right must still be
    // the answer readiness.ts treats as best, so existing check-ins and the
    // Tagesform math never shift just because the display was flipped.
    const bestAnswers: CheckinAnswers = {
      sleep: toStoredCheckinValue('sleep', 5),
      energy: toStoredCheckinValue('energy', 5),
      soreness: toStoredCheckinValue('soreness', 5),
      stress: toStoredCheckinValue('stress', 5),
    };

    assert.deepEqual(bestAnswers, { sleep: 5, energy: 5, soreness: 1, stress: 1 });
    assert.equal(wellnessScore(bestAnswers), 20);
  });
});
