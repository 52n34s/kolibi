import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expectedWeeklyAmount,
  expectedWeeklyProgressFraction,
  isoWeekdayIndex,
} from './movement-week-pace.ts';

function atWeekday(isoDay: number): Date {
  // 2026-09-07 is Monday. isoDay 1..7 → offset 0..6
  const d = new Date(2026, 8, 7 + (isoDay - 1), 15, 0, 0);
  return d;
}

describe('expectedWeeklyProgressFraction', () => {
  it('is 1/7 on Monday and 7/7 on Sunday', () => {
    assert.equal(isoWeekdayIndex(atWeekday(1)), 1);
    assert.equal(isoWeekdayIndex(atWeekday(7)), 7);
    assert.equal(expectedWeeklyProgressFraction(atWeekday(1)), 1 / 7);
    assert.equal(expectedWeeklyProgressFraction(atWeekday(7)), 1);
  });

  it('scales a 25 km week goal to ~7.1 km by Tuesday (2/7)', () => {
    const expected = expectedWeeklyAmount(25, atWeekday(2));
    assert.ok(Math.abs(expected - (25 * 2) / 7) < 1e-9);
    // Brief example rounds conceptually to 7 km
    assert.equal(Math.round(expected), 7);
  });
});
