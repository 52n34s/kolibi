import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  historyMacroActualSeries,
  historyMacroGoalSeries,
  type HistoryMacroDay,
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
