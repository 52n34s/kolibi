import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVITY_FACTORS,
  CalorieSource,
  calculateBmr,
  calculateDailyCalorieGoalForSource,
  calculateMaintenanceCalories,
  resolveCalorieSource,
  resolveDailyGoalFloor,
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
const GOAL_FLOOR = resolveDailyGoalFloor(BMR);

describe('resolveCalorieSource', () => {
  it('maps health connected to CalorieSource.HEALTH', () => {
    assert.equal(resolveCalorieSource(true), CalorieSource.HEALTH);
  });

  it('maps health disconnected to CalorieSource.ACTIVITY_FACTOR', () => {
    assert.equal(resolveCalorieSource(false), CalorieSource.ACTIVITY_FACTOR);
  });

  it('prefers OBSERVED when ready', () => {
    assert.equal(resolveCalorieSource(true, { observedReady: true }), CalorieSource.OBSERVED);
    assert.equal(resolveCalorieSource(false, { observedReady: true }), CalorieSource.OBSERVED);
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
      // Base keeps the deficit so the active-energy add-on has room, but a day
      // without captured activity never collapses below the floor.
      assert.ok(result.baseDailyGoal <= ROUNDED_BMR);
      assert.equal(result.effectiveDailyGoal, Math.max(result.baseDailyGoal, GOAL_FLOOR));
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
      assert.equal(
        result.effectiveDailyGoal,
        Math.max(result.baseDailyGoal + activeEnergy, GOAL_FLOOR),
      );
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

      // Health path: maintenance is BMR, energy is added after, floored at BMR.
      assert.equal(health.maintenanceCalories, ROUNDED_BMR);
      assert.equal(
        health.effectiveDailyGoal,
        Math.max(health.baseDailyGoal + 500, GOAL_FLOOR),
      );

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

  it('OBSERVED ignores active energy', () => {
    assert.equal(
      resolveEffectiveDailyCalorieGoal({
        calorieSource: CalorieSource.OBSERVED,
        baseDailyGoal: 2000,
        activeEnergyBurnedKcal: 400,
      }),
      2000,
    );
  });
});

describe('calculateMaintenanceCalories OBSERVED', () => {
  it('returns the measured maintenance', () => {
    assert.equal(
      calculateMaintenanceCalories({
        ...PROFILE,
        activityLevel: 'active',
        calorieSource: CalorieSource.OBSERVED,
        observedMaintenanceKcal: 2340,
      }),
      2340,
    );
  });
});

const DEFICIT_GOAL_TYPES = [
  'lose_weight',
  'faster_weight_loss',
  'maintain',
  'gain_weight',
  'build_muscle',
  'endurance',
] as const;

describe('resting metabolism floor', () => {
  for (const calorieSource of [
    CalorieSource.HEALTH,
    CalorieSource.ACTIVITY_FACTOR,
    CalorieSource.OBSERVED,
  ]) {
    for (const goalType of DEFICIT_GOAL_TYPES) {
      it(`${calorieSource} + ${goalType}: effective goal never drops below BMR`, () => {
        const result = calculateDailyCalorieGoalForSource({
          ...PROFILE,
          goalType,
          activityLevel: 'mostly_sitting',
          calorieSource,
          // Deliberately low so an unfloored result would land under the BMR.
          observedMaintenanceKcal: 1200,
          activeEnergyBurnedKcal: 0,
        });

        assert.ok(
          result.effectiveDailyGoal >= GOAL_FLOOR,
          `${result.effectiveDailyGoal} < ${GOAL_FLOOR}`,
        );
      });
    }
  }

  it('floors the display goal, not the stored base', () => {
    const result = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'faster_weight_loss',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.HEALTH,
      activeEnergyBurnedKcal: 0,
    });

    // The base keeps the deficit so the active-energy add-on still has room.
    assert.ok(result.baseDailyGoal < GOAL_FLOOR);
    assert.equal(result.effectiveDailyGoal, GOAL_FLOOR);
  });
});

describe('deficit cap reference', () => {
  it('HEALTH caps against BMR + mean active energy, not against the BMR', () => {
    const recentActiveEnergy = { avgKcal: 600, days: 14 };
    const withActiveEnergy = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'faster_weight_loss',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.HEALTH,
      recentActiveEnergy,
    });

    assert.equal(withActiveEnergy.expectedMaintenanceKcal, ROUNDED_BMR + 600);

    // Cap is a quarter of the expected day; the base still comes off the BMR.
    const expectedCap = (ROUNDED_BMR + 600) * 0.25;
    assert.equal(
      withActiveEnergy.baseDailyGoal,
      Math.round(withActiveEnergy.maintenanceCalories - expectedCap),
    );
  });

  it('falls back to the activity factor below seven days of Health data', () => {
    const thin = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'faster_weight_loss',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.HEALTH,
      recentActiveEnergy: { avgKcal: 600, days: 6 },
    });

    assert.equal(
      thin.expectedMaintenanceKcal,
      Math.round(BMR * ACTIVITY_FACTORS.mostly_sitting),
    );
  });
});

describe('floor leaves ordinary deficits alone', () => {
  it('sedentary + lose_weight keeps its deficit — the floor must not bind', () => {
    const result = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'lose_weight',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.ACTIVITY_FACTOR,
      activeEnergyBurnedKcal: 0,
    });

    assert.ok(result.baseDailyGoal < ROUNDED_BMR, 'deficit should dip under the BMR');
    assert.ok(result.baseDailyGoal > GOAL_FLOOR, 'but stay above the floor');
    assert.equal(result.effectiveDailyGoal, result.baseDailyGoal);
  });

  it('sedentary + faster_weight_loss stays above the floor too', () => {
    const result = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'faster_weight_loss',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.ACTIVITY_FACTOR,
      activeEnergyBurnedKcal: 0,
    });

    assert.equal(result.effectiveDailyGoal, result.baseDailyGoal);
  });

  // Guards `calculateDailyCalorieGoalForSource`, which no screen calls. The
  // onboarding summary runs `calculateDailyCalorieGoalDetails` instead and once
  // shipped `baseDailyGoal` straight to the user, so this assertion stayed green
  // through that bug. Its counterpart lives in onboarding-calorie-details.test.ts.
  it('catches the BMR-based collapse: a HEALTH day without movement', () => {
    const result = calculateDailyCalorieGoalForSource({
      ...PROFILE,
      goalType: 'faster_weight_loss',
      activityLevel: 'mostly_sitting',
      calorieSource: CalorieSource.HEALTH,
      activeEnergyBurnedKcal: 0,
    });

    assert.ok(result.baseDailyGoal < GOAL_FLOOR);
    assert.equal(result.effectiveDailyGoal, GOAL_FLOOR);
  });
});
