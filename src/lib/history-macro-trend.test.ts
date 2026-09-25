import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  historyMacroActualSeries,
  historyMacroGoalSeries,
  type HistoryMacroDay,
  isMacroDayInTarget,
  macroBubbleText,
  macroChartDomain,
  macroGoalChangeIndices,
  macroIndexAtX,
  macroTrendSummary,
} from './history-macro-trend.ts';

function day(params: {
  actual: number | null;
  goal: number | null;
  scaled?: number | null;
}): HistoryMacroDay {
  const grams = (value: number | null) => ({
    proteinG: value,
    carbsG: value,
    fatG: value,
    fiberG: value,
  });
  return {
    macros: grams(params.actual),
    goal: params.goal == null ? null : grams(params.goal),
    scaledGoal: params.scaled === undefined
      ? params.goal == null
        ? null
        : grams(params.goal)
      : params.scaled == null
        ? null
        : grams(params.scaled),
  };
}

describe('historyMacroActualSeries', () => {
  it('keeps unlogged days as null instead of 0 g', () => {
    assert.deepEqual(
      historyMacroActualSeries(
        [day({ actual: 49, goal: 80 }), day({ actual: null, goal: 80 }), day({ actual: 160, goal: 80 })],
        'protein',
      ),
      [49, null, 160],
    );
  });
});

describe('historyMacroGoalSeries', () => {
  it('prefers the sport-scaled goal for that day over the stored base', () => {
    assert.deepEqual(
      historyMacroGoalSeries(
        [
          day({ actual: 200, goal: 180, scaled: 180 }),
          day({ actual: 240, goal: 180, scaled: 260 }),
          day({ actual: 190, goal: 180, scaled: 180 }),
        ],
        'carbs',
      ),
      [180, 260, 180],
    );
  });

  it('falls back to the as-of calorie_goals row when scaling is missing', () => {
    assert.deepEqual(
      historyMacroGoalSeries(
        [day({ actual: 30, goal: 30, scaled: null })],
        'fiber',
      ),
      [30],
    );
  });
});

describe('macroChartDomain', () => {
  it('starts at 0 and leaves air above goal and highest value', () => {
    const domain = macroChartDomain([[140, 158, null], [163, 163, 163]]);
    assert.equal(domain.min, 0);
    assert.ok(domain.max >= 163 * 1.15);
    assert.equal(domain.max % 25, 0);
  });

  it('works for small values (fiber) and empty data', () => {
    assert.deepEqual(macroChartDomain([[12, 20], [30]]), { min: 0, max: 40, range: 40 });
    assert.deepEqual(macroChartDomain([[null]]), { min: 0, max: 5, range: 5 });
  });
});

describe('macroTrendSummary', () => {
  const dates = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];

  it('averages closed days, uses the mean of the day goals, today does not count', () => {
    const summary = macroTrendSummary({
      nutrient: 'protein',
      dates,
      actual: [150, null, 170, 160, 100, 165, 20],
      goal: [160, 160, 160, 170, 170, 170, 170],
      todayKey: '2026-09-25',
    });
    // Closed days with meals: 150/160, 170/160, 160/170, 100/170, 165/170.
    assert.deepEqual(summary, { avg: 149, goal: 166, hit: 1, days: 5 });
  });

  it('carbs and fat count within ±10 %, fiber at least the goal', () => {
    assert.equal(isMacroDayInTarget('carbs', 225, 250), true);
    assert.equal(isMacroDayInTarget('carbs', 280, 250), false);
    assert.equal(isMacroDayInTarget('fat', 60, 70), false);
    assert.equal(isMacroDayInTarget('fiber', 30, 30), true);
    assert.equal(isMacroDayInTarget('protein', 158, 163), false);
    assert.equal(isMacroDayInTarget('protein', 158, null), false);
  });
});

describe('macroGoalChangeIndices', () => {
  it('marks the day the goal changed', () => {
    assert.deepEqual([...macroGoalChangeIndices([160, 160, null, 172, 172])], [3]);
    assert.deepEqual([...macroGoalChangeIndices([160.2, 159.9])], []);
  });
});

describe('macroIndexAtX', () => {
  it('maps a touch to the nearest day and clamps at the edges', () => {
    const base = { count: 7, width: 316, padding: 16 };
    assert.equal(macroIndexAtX({ ...base, x: 16 }), 0);
    assert.equal(macroIndexAtX({ ...base, x: 158 }), 3);
    assert.equal(macroIndexAtX({ ...base, x: 400 }), 6);
    assert.equal(macroIndexAtX({ ...base, x: -20 }), 0);
  });
});

describe('macroBubbleText', () => {
  const t = (key: string, o?: Record<string, unknown>) => `${key}:${JSON.stringify(o)}`;
  it('value of goal, value alone without a goal, nothing without intake', () => {
    assert.equal(
      macroBubbleText({ dayLabel: 'Di', actual: 158.4, goal: 163, t }),
      'history.macro.bubble:{"day":"Di","value":158,"goal":163}',
    );
    assert.equal(
      macroBubbleText({ dayLabel: 'Di', actual: 158, goal: null, t }),
      'history.macro.bubbleNoGoal:{"day":"Di","value":158}',
    );
    assert.equal(macroBubbleText({ dayLabel: 'Di', actual: null, goal: 163, t }), null);
  });
});
