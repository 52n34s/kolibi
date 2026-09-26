import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkinScaleLabelOrder,
  isReversedCheckinScale,
  orderedCheckinSteps,
} from './checkin-scale.ts';
import { wellnessScore, type CheckinAnswers } from './readiness.ts';

describe('checkin-scale', () => {
  it('only soreness and stress are reversed', () => {
    assert.equal(isReversedCheckinScale('sleep'), false);
    assert.equal(isReversedCheckinScale('energy'), false);
    assert.equal(isReversedCheckinScale('soreness'), true);
    assert.equal(isReversedCheckinScale('stress'), true);
  });

  it('label order always puts the good end on the right', () => {
    // sleep/energy already store 5 = good, so low (bad) stays left.
    assert.deepEqual(checkinScaleLabelOrder('sleep'), ['low', 'high']);
    assert.deepEqual(checkinScaleLabelOrder('energy'), ['low', 'high']);
    // soreness/stress store 1 = good, so the "high" (bad) label moves left.
    assert.deepEqual(checkinScaleLabelOrder('soreness'), ['high', 'low']);
    assert.deepEqual(checkinScaleLabelOrder('stress'), ['high', 'low']);
  });

  it('button order matches the label order without renumbering the steps', () => {
    const steps = [1, 2, 3, 4, 5] as const;
    assert.deepEqual(orderedCheckinSteps(steps, 'sleep'), [1, 2, 3, 4, 5]);
    assert.deepEqual(orderedCheckinSteps(steps, 'energy'), [1, 2, 3, 4, 5]);
    assert.deepEqual(orderedCheckinSteps(steps, 'soreness'), [5, 4, 3, 2, 1]);
    assert.deepEqual(orderedCheckinSteps(steps, 'stress'), [5, 4, 3, 2, 1]);
  });

  it('the rightmost button for every question saves the best possible wellness score', () => {
    // Regression guard: whatever button ends up on the right must still be
    // the answer readiness.ts treats as best, so existing check-ins and the
    // Tagesform math never shift just because the display was reordered.
    const rightmost = (question: keyof CheckinAnswers): number => {
      const value = orderedCheckinSteps([1, 2, 3, 4, 5] as const, question).at(-1);
      if (value == null) {
        throw new Error(`no steps for ${question}`);
      }
      return value;
    };

    const bestAnswers: CheckinAnswers = {
      sleep: rightmost('sleep'),
      energy: rightmost('energy'),
      soreness: rightmost('soreness'),
      stress: rightmost('stress'),
    };

    assert.deepEqual(bestAnswers, { sleep: 5, energy: 5, soreness: 1, stress: 1 });
    assert.equal(wellnessScore(bestAnswers), 20);
  });
});
