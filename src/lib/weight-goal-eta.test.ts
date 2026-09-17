import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WEIGHT_ETA_MAX_DAYS,
  computeWeeklyTrendWeightChangePercent,
  computeWeightGoalEta,
  fuzzyMonthPart,
  linearSlopeKgPerDay,
  trailingMovingAverage,
} from './weight-goal-eta.ts';

function day(offset: number, from = new Date('2026-09-08T12:00:00')): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d;
}

function log(weightKg: number, dayOffset: number) {
  return { weightKg, loggedAt: day(dayOffset).toISOString() };
}

describe('fuzzyMonthPart', () => {
  it('maps day-of-month into early / mid / late', () => {
    assert.equal(fuzzyMonthPart(new Date(2027, 1, 3)), 'early');
    assert.equal(fuzzyMonthPart(new Date(2027, 1, 15)), 'mid');
    assert.equal(fuzzyMonthPart(new Date(2027, 1, 28)), 'late');
  });
});

describe('computeWeightGoalEta — theoretical', () => {
  it('uses 7700 kcal/kg when fewer than 14 days of data', () => {
    const today = day(0);
    // 5 kg to lose, 500 kcal/day deficit → 5*7700/500 = 77 days
    const result = computeWeightGoalEta({
      logs: [log(80, -3), log(79.8, -1)],
      targetWeightKg: 75,
      currentWeightKg: 80,
      dailyCalorieGoal: 1500,
      maintenanceCalories: 2000,
      goalDirection: 'loss',
      today,
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.method, 'theoretical');
      assert.equal(result.daysRemaining, 77);
    }
  });

  it('returns not_losing when deficit ≤ 0 and goal is loss', () => {
    const result = computeWeightGoalEta({
      logs: [],
      targetWeightKg: 75,
      currentWeightKg: 80,
      dailyCalorieGoal: 2200,
      maintenanceCalories: 2000,
      goalDirection: 'loss',
      today: day(0),
    });
    assert.equal(result.status, 'not_losing');
  });

  it('returns over_year when theoretical ETA exceeds 18 months', () => {
    const result = computeWeightGoalEta({
      logs: [],
      targetWeightKg: 70,
      currentWeightKg: 90,
      dailyCalorieGoal: 1990,
      maintenanceCalories: 2000, // 10 kcal/day → 20*7700/10 = 15400 days
      goalDirection: 'loss',
      today: day(0),
    });
    assert.equal(result.status, 'over_year');
    if (result.status === 'over_year') {
      assert.equal(result.method, 'theoretical');
    }
  });
});

describe('computeWeightGoalEta — trend smoothing', () => {
  it('uses trend when span ≥ 14 days', () => {
    const today = day(0);
    // Steady −0.1 kg/day on the raw series → ~50 days for 5 kg
    const logs = [];
    for (let i = 20; i >= 0; i -= 1) {
      logs.push(log(80 - (20 - i) * 0.1, -i));
    }
    const result = computeWeightGoalEta({
      logs,
      targetWeightKg: 75,
      goalDirection: 'loss',
      today,
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.method, 'trend');
      // Last weight ≈ 78 kg → 3 kg to target at ~0.1 kg/day ≈ 30 days
      assert.ok(
        result.daysRemaining > 20 && result.daysRemaining < 45,
        `unexpected daysRemaining ${result.daysRemaining}`,
      );
    }
  });

  it('±0.8 kg day-to-day noise shifts ETA by at most a few days', () => {
    const today = day(0);
    const baseLogs = [];
    for (let i = 21; i >= 0; i -= 1) {
      baseLogs.push(log(82 - (21 - i) * 0.05, -i));
    }

    const noisyA = baseLogs.map((entry, index) =>
      index === baseLogs.length - 1
        ? { ...entry, weightKg: entry.weightKg + 0.8 }
        : entry,
    );
    const noisyB = baseLogs.map((entry, index) =>
      index === baseLogs.length - 1
        ? { ...entry, weightKg: entry.weightKg - 0.8 }
        : entry,
    );

    const etaA = computeWeightGoalEta({
      logs: noisyA,
      targetWeightKg: 75,
      goalDirection: 'loss',
      today,
    });
    const etaB = computeWeightGoalEta({
      logs: noisyB,
      targetWeightKg: 75,
      goalDirection: 'loss',
      today,
    });

    assert.equal(etaA.status, 'ok');
    assert.equal(etaB.status, 'ok');
    if (etaA.status === 'ok' && etaB.status === 'ok') {
      const deltaDays = Math.abs(etaA.daysRemaining - etaB.daysRemaining);
      assert.ok(
        deltaDays <= 7,
        `expected ≤7 day ETA swing, got ${deltaDays} (${etaA.daysRemaining} vs ${etaB.daysRemaining})`,
      );
    }
  });

  it('moving average dampens a single spike more than raw endpoints', () => {
    const points = [];
    for (let i = 0; i < 14; i += 1) {
      points.push({
        day: 1000 + i,
        weightKg: 80 - i * 0.05,
        at: day(i - 13),
      });
    }
    points[points.length - 1]!.weightKg += 0.8;
    const smoothed = trailingMovingAverage(points);
    const rawSlope = linearSlopeKgPerDay(points)!;
    const smoothSlope = linearSlopeKgPerDay(smoothed)!;
    // Smoothed slope should stay closer to the underlying −0.05 kg/day.
    assert.ok(Math.abs(smoothSlope - -0.05) < Math.abs(rawSlope - -0.05));
  });
});

describe('computeWeeklyTrendWeightChangePercent', () => {
  it('uses the moving-average Theil–Sen trend as a percentage of current weight', () => {
    const today = day(0);
    const logs = [];
    for (let i = 20; i >= 0; i -= 1) {
      logs.push(log(80 - (20 - i) * 0.1, -i));
    }

    const trend = computeWeeklyTrendWeightChangePercent(logs, today);
    assert.ok(trend != null);
    assert.ok(trend.weeklyChangePercent < -0.8 && trend.weeklyChangePercent > -1.0);
  });
});

describe('WEIGHT_ETA_MAX_DAYS', () => {
  it('covers about 18 months', () => {
    assert.ok(WEIGHT_ETA_MAX_DAYS >= 540 && WEIGHT_ETA_MAX_DAYS <= 560);
  });
});
