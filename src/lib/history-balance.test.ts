import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  accuracyFromProteinDistributionDays,
  accuracyFromTrackedDays,
  accuracyFromWeighIns,
  computeBalanceStats,
  computeBalanceSummaryHeadline,
  computeProteinDistributionStats,
  detectRepeatedCalorieUndershoot,
  formatBalanceAccuracyValue,
  pickBalanceAccuracyHint,
  shouldShowWeightChangeDelta,
} from './history-balance-stats.ts';
import type { HistorySummaryStats } from './history.ts';

function summary(overrides: Partial<HistorySummaryStats> = {}): HistorySummaryStats {
  return {
    calorieAvg: null,
    calorieGoalAvg: null,
    proteinAvg: 100,
    proteinGoalAvg: 100,
    proteinHitDays: 5,
    proteinTrackedDays: 5,
    carbsAvg: 100,
    carbsGoalAvg: 100,
    fatAvg: 70,
    fatGoalAvg: 70,
    fiberAvg: 30,
    fiberGoalAvg: 30,
    loggedDays: 5,
    rangeDayCount: 6,
    ...overrides,
  };
}

describe('computeBalanceStats', () => {
  it('treats deviations below five percent as within range', () => {
    const stats = computeBalanceStats(
      summary({ proteinAvg: 96, fiberAvg: 29, fatAvg: 68, carbsAvg: 104 }),
      100,
    );

    assert.equal(stats.proteinOk, true);
    assert.equal(stats.fiberOk, true);
    assert.equal(stats.fatOk, true);
    assert.equal(stats.carbsOk, true);
    assert.equal(stats.allOk, true);
  });

  it('reports gram deltas and considers only underages for contributing foods', () => {
    const stats = computeBalanceStats(
      summary({
        proteinAvg: 70,
        fiberAvg: 27,
        fatAvg: 60,
        carbsAvg: 130,
      }),
      100,
    );

    assert.equal(stats.proteinDeltaG, -30);
    assert.equal(stats.proteinOk, false);
    assert.equal(stats.fatBelowFloor, true);
    assert.equal(stats.carbsOverGoal, true);
    assert.equal(stats.deviatingNutrient, 'protein');
    assert.equal(stats.allOk, false);
  });
});

describe('balance accuracy', () => {
  it('grades weigh-ins by count and span', () => {
    assert.equal(accuracyFromWeighIns({ weighDayCount: 1, spanDays: 14 }), 'unavailable');
    assert.equal(accuracyFromWeighIns({ weighDayCount: 3, spanDays: 5 }), 'unavailable');
    assert.equal(accuracyFromWeighIns({ weighDayCount: 3, spanDays: 14 }), 'very_rough');
    assert.equal(accuracyFromWeighIns({ weighDayCount: 5, spanDays: 14 }), 'rough');
    assert.equal(accuracyFromWeighIns({ weighDayCount: 8, spanDays: 14 }), 'reliable');
  });

  it('hides the kg-delta until the same minimum the trend hint names', () => {
    assert.equal(
      shouldShowWeightChangeDelta({ uniqueWeighDaysInRange: 2, weighDaysLastMonth: 2 }),
      false,
    );
    assert.equal(
      shouldShowWeightChangeDelta({ uniqueWeighDaysInRange: 3, weighDaysLastMonth: 5 }),
      false,
    );
    assert.equal(
      shouldShowWeightChangeDelta({ uniqueWeighDaysInRange: 2, weighDaysLastMonth: 10 }),
      false,
    );
    assert.equal(
      shouldShowWeightChangeDelta({ uniqueWeighDaysInRange: 3, weighDaysLastMonth: 8 }),
      true,
    );
  });

  it('grades macros and protein distribution by tracked days', () => {
    assert.equal(accuracyFromTrackedDays(1), 'unavailable');
    assert.equal(accuracyFromTrackedDays(3), 'very_rough');
    assert.equal(accuracyFromTrackedDays(5), 'rough');
    assert.equal(accuracyFromTrackedDays(6), 'reliable');
    assert.equal(accuracyFromProteinDistributionDays(0), 'unavailable');
    assert.equal(accuracyFromProteinDistributionDays(2), 'very_rough');
    assert.equal(accuracyFromProteinDistributionDays(4), 'rough');
    assert.equal(accuracyFromProteinDistributionDays(5), 'reliable');
  });

  it('formats values with a mark and secondary tone when rough', () => {
    assert.deepEqual(formatBalanceAccuracyValue('✓', 'reliable'), {
      text: '✓',
      tone: 'default',
    });
    assert.deepEqual(formatBalanceAccuracyValue('✓', 'rough'), {
      text: '✓ •',
      tone: 'default',
    });
    assert.deepEqual(formatBalanceAccuracyValue('✓', 'very_rough'), {
      text: '✓ •',
      tone: 'secondary',
    });
    assert.deepEqual(formatBalanceAccuracyValue('✓', 'unavailable'), {
      text: '—',
      tone: 'default',
    });
  });

  it('picks one hint for the weakest row', () => {
    assert.deepEqual(
      pickBalanceAccuracyHint({
        weighIns: { accuracy: 'rough', count: 5 },
        trackedDays: { accuracy: 'very_rough', count: 3 },
        proteinDistribution: null,
      }),
      { kind: 'tracked_days', count: 3 },
    );
    assert.equal(
      pickBalanceAccuracyHint({
        weighIns: { accuracy: 'reliable', count: 10 },
        trackedDays: { accuracy: 'reliable', count: 7 },
        proteinDistribution: { accuracy: 'reliable', count: 6 },
      }),
      null,
    );
  });
});

describe('computeBalanceSummaryHeadline', () => {
  it('returns on_track when gaps stay within five percent', () => {
    assert.deepEqual(
      computeBalanceSummaryHeadline({
        summary: summary({ proteinAvg: 96, fiberAvg: 29, fatAvg: 68, carbsAvg: 104 }),
        referenceWeightKg: 100,
        macroAccuracy: 'reliable',
      }),
      { kind: 'on_track' },
    );
  });

  it('picks the largest relative gap and omits calories', () => {
    assert.deepEqual(
      computeBalanceSummaryHeadline({
        summary: summary({
          proteinAvg: 90,
          proteinGoalAvg: 100,
          fiberAvg: 20,
          fiberGoalAvg: 30,
          carbsAvg: 100,
          carbsGoalAvg: 100,
        }),
        referenceWeightKg: 100,
        macroAccuracy: 'rough',
      }),
      { kind: 'large', nutrient: 'fiber', amountG: 10, direction: 'under' },
    );
  });

  it('uses the soft tier between five and twenty percent', () => {
    assert.deepEqual(
      computeBalanceSummaryHeadline({
        summary: summary({
          proteinAvg: 90,
          proteinGoalAvg: 100,
          fiberAvg: 30,
          fiberGoalAvg: 30,
          fatAvg: 70,
          fatGoalAvg: 70,
          carbsAvg: 100,
          carbsGoalAvg: 100,
        }),
        referenceWeightKg: 100,
        macroAccuracy: 'reliable',
      }),
      { kind: 'small', nutrient: 'protein', amountG: 10, direction: 'under' },
    );
  });

  it('returns null when macro accuracy is very rough', () => {
    assert.equal(
      computeBalanceSummaryHeadline({
        summary: summary({ proteinAvg: 50, proteinGoalAvg: 100 }),
        referenceWeightKg: 100,
        macroAccuracy: 'very_rough',
      }),
      null,
    );
  });
});

function undershootDay(params: {
  date: string;
  calories: number;
  goal: number | null;
  hasMeals?: boolean;
}) {
  return {
    date: params.date,
    hasMeals: params.hasMeals ?? true,
    totalCalories: params.calories,
    calorieGoal: params.goal,
  };
}

/** 7 closed days Mon–Sun 14–20 Sep, plus in-progress 21 Sep. */
function closedWeek(overrides: Record<string, Partial<{
  calories: number;
  goal: number | null;
  hasMeals: boolean;
}>> = {}) {
  const dates = [
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
    '2026-09-20',
  ];
  const closed = dates.map((date) => {
    const extra = overrides[date] ?? {};
    return undershootDay({
      date,
      calories: extra.calories ?? 2000,
      goal: extra.goal === undefined ? 2000 : extra.goal,
      hasMeals: extra.hasMeals,
    });
  });
  return [
    ...closed,
    undershootDay({ date: '2026-09-21', calories: 0, goal: 2000, hasMeals: false }),
  ];
}

describe('detectRepeatedCalorieUndershoot', () => {
  const todayKey = '2026-09-21';

  it('ignores an untracked day instead of treating it as a 2000 kcal hole', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1000 },
          '2026-09-15': { calories: 1000 },
          '2026-09-16': { calories: 1000 },
          '2026-09-17': { hasMeals: false, calories: 0 },
        }),
      }),
      false,
    );
  });

  it('returns false when a closed day has meals but no calorie goal', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1000 },
          '2026-09-15': { calories: 1000 },
          '2026-09-16': { calories: 1000 },
          '2026-09-17': { goal: null },
        }),
      }),
      false,
    );
  });

  it('returns false without seven complete closed days in the payload', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek().slice(2),
      }),
      false,
    );
  });

  it('returns false when only two complete days are more than 25% under', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1400 },
          '2026-09-15': { calories: 1400 },
        }),
      }),
      false,
    );
  });

  it('returns false at exactly 25% under — the gap must be strictly larger', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1500 },
          '2026-09-15': { calories: 1500 },
          '2026-09-16': { calories: 1500 },
        }),
      }),
      false,
    );
  });

  it('returns true for three of the last seven fully logged days', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1400 },
          '2026-09-16': { calories: 1000 },
          '2026-09-20': { calories: 1499 },
        }),
      }),
      true,
    );
  });

  it('does not count today even when it looks empty', () => {
    assert.equal(
      detectRepeatedCalorieUndershoot({
        todayKey,
        days: closedWeek({
          '2026-09-14': { calories: 1400 },
          '2026-09-15': { calories: 1400 },
        }),
      }),
      false,
    );
  });
});

/** One logged entry at a local wall-clock time on a YYYY-MM-DD day. */
function logged(
  date: string,
  time: string,
  totalCalories: number,
  proteinG: number | null,
) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return {
    date,
    eatenAt: new Date(y!, m! - 1, d!, h!, min!).toISOString(),
    totalCalories,
    proteinG,
  };
}

describe('computeProteinDistributionStats', () => {
  it('ignores low-calorie meals and averages only complete protein days', () => {
    const stats = computeProteinDistributionStats(
      [
        logged('2026-09-11', '08:00', 500, 30),
        logged('2026-09-11', '12:30', 350, 20),
        logged('2026-09-11', '16:00', 50, null),
        logged('2026-09-12', '12:00', 400, 25),
        logged('2026-09-13', '12:00', 300, 30),
        logged('2026-09-14', '12:00', 300, 25),
        logged('2026-09-15', '12:00', 300, 25),
        logged('2026-09-16', '12:00', 300, null),
      ],
      83,
    );

    assert.ok(stats != null);
    assert.equal(stats.thresholdG, 25);
    assert.equal(stats.trackedDays, 5);
    assert.equal(stats.averageMealsAtThreshold, 1);
    assert.equal(stats.averageMealCount, 1.2);
  });

  it('returns stats for fewer than five eligible days', () => {
    const stats = computeProteinDistributionStats(
      [logged('2026-09-11', '12:00', 400, 30), logged('2026-09-12', '12:00', 400, 25)],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.trackedDays, 2);
  });

  it('counts grouped entries as one meal', () => {
    // 12:00 + 12:30 + 13:10 chain into one lunch with 15 + 10 + 5 = 30 g.
    const stats = computeProteinDistributionStats(
      [
        logged('2026-09-11', '12:00', 300, 15),
        logged('2026-09-11', '12:30', 200, 10),
        logged('2026-09-11', '13:10', 150, 5),
        logged('2026-09-11', '19:00', 600, 20),
      ],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.averageMealCount, 2);
    assert.equal(stats.averageMealsAtThreshold, 1);
  });

  it('keeps entries more than 45 minutes apart as separate meals', () => {
    const stats = computeProteinDistributionStats(
      [logged('2026-09-11', '12:00', 300, 15), logged('2026-09-11', '12:46', 300, 15)],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.averageMealCount, 2);
    assert.equal(stats.averageMealsAtThreshold, 0);
  });

  it('counts small entries once they add up to a meal of 100 kcal', () => {
    const stats = computeProteinDistributionStats(
      [logged('2026-09-11', '15:00', 60, 3), logged('2026-09-11', '15:20', 60, 4)],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.averageMealCount, 1);
  });

  it('treats a small entry without protein data as 0 g inside a meal', () => {
    const stats = computeProteinDistributionStats(
      [logged('2026-09-11', '08:00', 400, 26), logged('2026-09-11', '08:10', 40, null)],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.trackedDays, 1);
    assert.equal(stats.averageMealsAtThreshold, 1);
  });

  it('drops the day when a larger entry of a meal lacks protein data', () => {
    const stats = computeProteinDistributionStats(
      [logged('2026-09-11', '08:00', 400, 26), logged('2026-09-11', '08:10', 150, null)],
      83,
    );
    assert.equal(stats, null);
  });
});
