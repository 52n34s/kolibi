import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVITY_FACTORS,
  CalorieSource,
  calculateBmr,
  resolveDailyGoalFloor,
} from './calorie-goal-math.ts';
import { calculateDailyCalorieGoalDetails } from './onboarding-calorie-goal.ts';

/**
 * Covers the path the onboarding summary actually renders.
 * `calorie-goal-math.test.ts` exercises `calculateDailyCalorieGoalForSource`,
 * which no screen calls — including its "BMR-based collapse" case, which passed
 * while the summary shipped the unfloored base as the user's daily goal.
 */

const TODAY = new Date('2026-01-01T00:00:00.000Z');
const BIRTH_DATE = new Date('1986-01-01T00:00:00.000Z');

const PROFILE = {
  biologicalSex: 'male' as const,
  birthDate: BIRTH_DATE,
  heightCm: 186,
  weightKg: 80.7,
};

/** The math rounds off the raw BMR, the fixtures off the reported one — 1 kcal apart. */
function assertWithinOne(actual: number, expected: number, message: string): void {
  assert.ok(
    Math.abs(actual - expected) <= 1,
    `${message}: expected ~${expected}, got ${actual}`,
  );
}

function bmrOf(weightKg = PROFILE.weightKg): number {
  return Math.round(
    calculateBmr({
      biologicalSex: PROFILE.biologicalSex,
      weightKg,
      heightCm: PROFILE.heightCm,
      age: TODAY.getFullYear() - BIRTH_DATE.getFullYear(),
    }),
  );
}

describe('calculateDailyCalorieGoalDetails — HEALTH with an active-energy window', () => {
  const result = calculateDailyCalorieGoalDetails({
    ...PROFILE,
    activityLevel: 'lightly_active',
    calorieSource: CalorieSource.HEALTH,
    goalType: 'lose_weight',
    recentActiveEnergy: { avgKcal: 650, days: 14 },
  });

  it('keeps maintenance at the bare BMR', () => {
    assert.equal(result.maintenanceCalories, result.bmr);
  });

  it('measures expected maintenance as BMR + mean active energy', () => {
    assert.equal(result.expectedMaintenanceKcal, result.bmr + 650);
    assert.equal(result.expectedActiveEnergyKcal, 650);
  });

  it('stores a base below the floor — active energy joins at display time', () => {
    assert.ok(result.dailyCalories < result.minimumCalories);
    assert.equal(
      result.dailyCalories,
      Math.round(result.bmr - result.dailyCalorieAdjustment),
    );
  });

  it('displays the expected day, not the base', () => {
    assert.equal(
      result.effectiveDailyCalories,
      result.dailyCalories + result.expectedActiveEnergyKcal,
    );
    assert.ok(result.effectiveDailyCalories > result.dailyCalories);
  });

  it('lands the displayed goal within the 25% cap of expected maintenance', () => {
    const deficitFraction =
      (result.expectedMaintenanceKcal - result.effectiveDailyCalories) /
      result.expectedMaintenanceKcal;
    assert.ok(deficitFraction > 0);
    assert.ok(deficitFraction <= 0.25);
  });

  it('does not report a floor breach for an ordinary deficit', () => {
    assert.equal(result.clampedToMinimum, false);
  });
});

describe('calculateDailyCalorieGoalDetails — HEALTH without an active-energy window', () => {
  const result = calculateDailyCalorieGoalDetails({
    ...PROFILE,
    activityLevel: 'lightly_active',
    calorieSource: CalorieSource.HEALTH,
    goalType: 'lose_weight',
    recentActiveEnergy: { avgKcal: 700, days: 3 },
  });

  it('falls back to the activity factor for the expected day', () => {
    assertWithinOne(
      result.expectedMaintenanceKcal,
      Math.round(result.bmr * ACTIVITY_FACTORS.lightly_active),
      'expected maintenance follows the activity factor',
    );
  });

  it('still displays base plus the movement the fallback implies', () => {
    assert.equal(
      result.expectedActiveEnergyKcal,
      result.expectedMaintenanceKcal - result.bmr,
    );
    assert.equal(
      result.effectiveDailyCalories,
      result.dailyCalories + result.expectedActiveEnergyKcal,
    );
  });
});

describe('calculateDailyCalorieGoalDetails — ACTIVITY_FACTOR', () => {
  const result = calculateDailyCalorieGoalDetails({
    ...PROFILE,
    activityLevel: 'lightly_active',
    calorieSource: CalorieSource.ACTIVITY_FACTOR,
    goalType: 'lose_weight',
  });

  it('builds maintenance from the activity multiplier', () => {
    assertWithinOne(
      result.maintenanceCalories,
      Math.round(result.bmr * ACTIVITY_FACTORS.lightly_active),
      'maintenance follows the activity factor',
    );
  });

  it('adds no movement on top — the multiplier already carries it', () => {
    assert.equal(result.expectedActiveEnergyKcal, 0);
    assert.equal(result.expectedMaintenanceKcal, result.maintenanceCalories);
    assert.equal(result.effectiveDailyCalories, result.dailyCalories);
  });
});

describe('calculateDailyCalorieGoalDetails — floor', () => {
  it('lifts the displayed goal to 0.85 × BMR when the deficit collapses it', () => {
    const result = calculateDailyCalorieGoalDetails({
      ...PROFILE,
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.ACTIVITY_FACTOR,
      goalType: 'custom',
      customCalorieGoal: 1100,
    });

    assert.equal(result.minimumCalories, resolveDailyGoalFloor(result.bmr));
    assert.ok(result.minimumCalories > 1100);
    assert.equal(result.effectiveDailyCalories, result.minimumCalories);
    assert.equal(result.clampedToMinimum, true);
  });

  it('uses the same floor the home screen applies', () => {
    const result = calculateDailyCalorieGoalDetails({
      ...PROFILE,
      activityLevel: 'lightly_active',
      calorieSource: CalorieSource.HEALTH,
      goalType: 'lose_weight',
      recentActiveEnergy: { avgKcal: 650, days: 14 },
    });

    assert.equal(result.minimumCalories, resolveDailyGoalFloor(bmrOf()));
  });

  it('never drops the stored base below the hard minimum', () => {
    const result = calculateDailyCalorieGoalDetails({
      ...PROFILE,
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.ACTIVITY_FACTOR,
      goalType: 'custom',
      customCalorieGoal: 200,
    });

    assert.equal(result.dailyCalories, 1000);
  });
});

describe('calculateDailyCalorieGoalDetails — deficit cap', () => {
  it('caps a heavy goal against expected maintenance, not against the BMR', () => {
    const result = calculateDailyCalorieGoalDetails({
      ...PROFILE,
      weightKg: 140,
      activityLevel: 'lightly_active',
      calorieSource: CalorieSource.HEALTH,
      goalType: 'faster_weight_loss',
      recentActiveEnergy: { avgKcal: 650, days: 14 },
    });

    assert.equal(result.cappedToMaxTdeeAdjustment, true);
    assert.equal(
      result.dailyCalorieAdjustment,
      result.expectedMaintenanceKcal * 0.25,
    );
    assert.ok(result.dailyCalorieAdjustment < result.uncappedDailyCalorieAdjustment);
  });

  it('leaves an ordinary deficit uncapped', () => {
    const result = calculateDailyCalorieGoalDetails({
      ...PROFILE,
      activityLevel: 'lightly_active',
      calorieSource: CalorieSource.HEALTH,
      goalType: 'lose_weight',
      recentActiveEnergy: { avgKcal: 650, days: 14 },
    });

    assert.equal(result.cappedToMaxTdeeAdjustment, false);
    assert.equal(
      result.dailyCalorieAdjustment,
      result.uncappedDailyCalorieAdjustment,
    );
  });
});
