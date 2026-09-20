import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  accuracyFromProteinDistributionDays,
  accuracyFromTrackedDays,
  accuracyFromWeighIns,
  computeBalanceStats,
  computeBalanceSummaryHeadline,
  computeProteinDistributionStats,
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

describe('computeProteinDistributionStats', () => {
  it('ignores low-calorie meals and averages only complete protein days', () => {
    const stats = computeProteinDistributionStats(
      [
        { date: '2026-09-11', totalCalories: 500, proteinG: 30 },
        { date: '2026-09-11', totalCalories: 350, proteinG: 20 },
        { date: '2026-09-11', totalCalories: 50, proteinG: null },
        { date: '2026-09-12', totalCalories: 400, proteinG: 25 },
        { date: '2026-09-13', totalCalories: 300, proteinG: 30 },
        { date: '2026-09-14', totalCalories: 300, proteinG: 25 },
        { date: '2026-09-15', totalCalories: 300, proteinG: 25 },
        { date: '2026-09-16', totalCalories: 300, proteinG: null },
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
      [
        { date: '2026-09-11', totalCalories: 400, proteinG: 30 },
        { date: '2026-09-12', totalCalories: 400, proteinG: 25 },
      ],
      83,
    );
    assert.ok(stats != null);
    assert.equal(stats.trackedDays, 2);
  });
});
