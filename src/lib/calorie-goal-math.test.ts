import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVITY_FACTORS,
  CalorieSource,
  calculateBmr,
  calculateDailyCalorieGoalForSource,
  calculateMaintenanceCalories,
  resolveCalorieSource,
  resolveEffectiveDailyCalorieGoal,
  type ActivityLevel,
} from './calorie-goal-math.ts';

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'mostly_sitting',
  'lightly_active',
  'active',
  'very_active',
];

/** Fixed profile so expected values are deterministic. */
const PROFILE = {
  biologicalSex: 'male' as const,
  birthDate: new Date(1990, 0, 15),
  heightCm: 180,
  weightKg: 80,
  goalType: 'lose_weight' as const,
  today: new Date(2026, 8, 8),
};

const AGE = 36; // 2026-09-08 vs 1990-01-15
const BMR = calculateBmr({
  biologicalSex: PROFILE.biologicalSex,
  weightKg: PROFILE.weightKg,
  heightCm: PROFILE.heightCm,
  age: AGE,
});
const ROUNDED_BMR = Math.round(BMR);

describe('resolveCalorieSource', () => {
  it('maps health connected to CalorieSource.HEALTH', () => {
    assert.equal(resolveCalorieSource(true), CalorieSource.HEALTH);
  });

  it('maps health disconnected to CalorieSource.ACTIVITY_FACTOR', () => {
    assert.equal(resolveCalorieSource(false), CalorieSource.ACTIVITY_FACTOR);
  });
});

describe('calculateDailyCalorieGoalForSource — 4 levels × health on/off', () => {
  for (const activityLevel of ACTIVITY_LEVELS) {
    it(`ACTIVITY_FACTOR + ${activityLevel}: uses BMR × factor, ignores active energy`, () => {
      const withZeroEnergy = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.ACTIVITY_FACTOR,
        activeEnergyBurnedKcal: 0,
      });
      const withFakeEnergy = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.ACTIVITY_FACTOR,
        activeEnergyBurnedKcal: 800,
      });

      const expectedMaintenance = Math.round(BMR * ACTIVITY_FACTORS[activityLevel]);
      assert.equal(withZeroEnergy.calorieSource, CalorieSource.ACTIVITY_FACTOR);
      assert.equal(withZeroEnergy.bmr, ROUNDED_BMR);
      assert.equal(withZeroEnergy.maintenanceCalories, expectedMaintenance);
      assert.notEqual(withZeroEnergy.maintenanceCalories, ROUNDED_BMR);
      assert.equal(withZeroEnergy.effectiveDailyGoal, withZeroEnergy.baseDailyGoal);
      // Active energy must not change the effective goal in ACTIVITY_FACTOR mode.
      assert.equal(withFakeEnergy.effectiveDailyGoal, withZeroEnergy.effectiveDailyGoal);
      assert.equal(withFakeEnergy.effectiveDailyGoal, withFakeEnergy.baseDailyGoal);
    });

    it(`HEALTH + ${activityLevel}: ignores activity factor; zero AE ⇒ BMR − deficit`, () => {
      const result = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.HEALTH,
        activeEnergyBurnedKcal: 0,
      });

      assert.equal(result.calorieSource, CalorieSource.HEALTH);
      assert.equal(result.bmr, ROUNDED_BMR);
      assert.equal(result.maintenanceCalories, ROUNDED_BMR);
      assert.equal(
        result.maintenanceCalories,
        calculateMaintenanceCalories({
          ...PROFILE,
          activityLevel,
          calorieSource: CalorieSource.HEALTH,
        }),
      );
      // Day without captured activity: effective goal is exactly base (BMR − deficit).
      assert.equal(result.effectiveDailyGoal, result.baseDailyGoal);
      assert.ok(result.baseDailyGoal <= ROUNDED_BMR);
    });

    it(`HEALTH + ${activityLevel}: adds active energy on top of BMR-based base`, () => {
      const activeEnergy = 450;
      const result = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.HEALTH,
        activeEnergyBurnedKcal: activeEnergy,
      });

      assert.equal(result.maintenanceCalories, ROUNDED_BMR);
      assert.equal(result.effectiveDailyGoal, result.baseDailyGoal + activeEnergy);
    });
  }

  it('never applies activity factor and active energy in the same effective goal', () => {
    for (const activityLevel of ACTIVITY_LEVELS) {
      const health = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.HEALTH,
        activeEnergyBurnedKcal: 500,
      });
      const factor = calculateDailyCalorieGoalForSource({
        ...PROFILE,
        activityLevel,
        calorieSource: CalorieSource.ACTIVITY_FACTOR,
        activeEnergyBurnedKcal: 500,
      });

      // Health path: maintenance is BMR, energy is added after.
      assert.equal(health.maintenanceCalories, ROUNDED_BMR);
      assert.equal(health.effectiveDailyGoal, health.baseDailyGoal + 500);

      // Factor path: maintenance uses multiplier; energy is ignored.
      assert.equal(
        factor.maintenanceCalories,
        Math.round(BMR * ACTIVITY_FACTORS[activityLevel]),
      );
      assert.equal(factor.effectiveDailyGoal, factor.baseDailyGoal);

      // The two exclusive paths must not produce the double-counted combo:
      // (BMR × factor) + active energy.
      const doubleCounted =
        Math.round(BMR * ACTIVITY_FACTORS[activityLevel]) -
        (factor.maintenanceCalories - factor.baseDailyGoal) +
        500;
      // Simpler check: health effective is never factor-maintenance + AE.
      assert.notEqual(
        health.effectiveDailyGoal,
        factor.maintenanceCalories + 500,
      );
      assert.notEqual(health.effectiveDailyGoal, doubleCounted);
    }
  });
});

describe('resolveEffectiveDailyCalorieGoal', () => {
  it('HEALTH adds active energy', () => {
    assert.equal(
      resolveEffectiveDailyCalorieGoal({
        calorieSource: CalorieSource.HEALTH,
        baseDailyGoal: 1800,
        activeEnergyBurnedKcal: 300,
      }),
      2100,
    );
  });

  it('ACTIVITY_FACTOR ignores active energy', () => {
    assert.equal(
      resolveEffectiveDailyCalorieGoal({
        calorieSource: CalorieSource.ACTIVITY_FACTOR,
        baseDailyGoal: 2200,
        activeEnergyBurnedKcal: 300,
      }),
      2200,
    );
  });
});
