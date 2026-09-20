/**
 * Calorie-goal math behind the onboarding summary.
 *
 * Kept free of React Native and Supabase imports so unit tests can load it:
 * `onboarding.ts` pulls in the auth store and the Supabase client, which the
 * strip-types test runner cannot parse. This module is re-exported from there,
 * so call sites keep importing from `@/lib/onboarding`.
 */
import {
  ACTIVITY_FACTORS as ACTIVITY_FACTORS_MATH,
  CalorieSource,
  DAYS_PER_WEEK as DAYS_PER_WEEK_MATH,
  GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK as GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK_MATH,
  HARD_MINIMUM_DAILY_CALORIES as HARD_MINIMUM_DAILY_CALORIES_MATH,
  KCAL_PER_KG_BODY_WEIGHT as KCAL_PER_KG_BODY_WEIGHT_MATH,
  MAX_TDEE_ADJUSTMENT_FRACTION as MAX_TDEE_ADJUSTMENT_FRACTION_MATH,
  calculateAge as calculateAgeMath,
  calculateBmr as calculateBmrMath,
  calculateMaintenanceCalories as calculateMaintenanceCaloriesMath,
  calculateTdee as calculateTdeeMath,
  calculateUncappedDailyCalorieAdjustment as calculateUncappedDailyCalorieAdjustmentMath,
  resolveCalorieSource,
  resolveDailyGoalFloor,
  resolveEffectiveDailyCalorieGoal,
  resolveExpectedMaintenanceKcal as resolveExpectedMaintenanceKcalMath,
  type ActivityLevel as ActivityLevelMath,
  type BiologicalSex as BiologicalSexMath,
  type GoalType as GoalTypeMath,
  type RecentActiveEnergy,
} from '@/lib/calorie-goal-math';

export type BiologicalSex = BiologicalSexMath;
export type ActivityLevel = ActivityLevelMath;
export type GoalType = GoalTypeMath;
export type CalorieGoalSource = 'calculated' | 'custom';
export {
  CalorieSource,
  resolveCalorieSource,
  resolveDailyGoalFloor,
  resolveEffectiveDailyCalorieGoal,
  type RecentActiveEnergy,
};

export const ACTIVITY_FACTORS = ACTIVITY_FACTORS_MATH;
export const HARD_MINIMUM_DAILY_CALORIES = HARD_MINIMUM_DAILY_CALORIES_MATH;
export const MAXIMUM_DAILY_CALORIES = 6000;
export const KCAL_PER_KG_BODY_WEIGHT = KCAL_PER_KG_BODY_WEIGHT_MATH;
export const DAYS_PER_WEEK = DAYS_PER_WEEK_MATH;
export const MAX_TDEE_ADJUSTMENT_FRACTION = MAX_TDEE_ADJUSTMENT_FRACTION_MATH;
/** Soft warning band around maintenance (±30% ≈ below ~70% or above ~130% of TDEE). Save still allowed. */
export const WARNING_TDEE_DEVIATION_FRACTION = 0.3;

/** Target body-weight change rate per week (% of current body weight). */
export const GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK = GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK_MATH;

export const GOAL_WEIGHT_CHANGE_PERCENT_RANGES = {
  gain_weight: { min: 0.25, max: 0.5 },
} as const;

export type CalorieGoalCalculation = {
  /** Resting metabolism — the reference behind the displayed goal's floor. */
  bmr: number;
  maintenanceCalories: number;
  /** What an average day is expected to burn — the cap reference and the label. */
  expectedMaintenanceKcal: number;
  /** Movement an average day adds on top of the base goal. Zero outside HEALTH. */
  expectedActiveEnergyKcal: number;
  uncappedDailyCalorieAdjustment: number;
  dailyCalorieAdjustment: number;
  rawCalories: number;
  /**
   * The stored base goal. Under HEALTH this sits below the floor on purpose:
   * active energy only joins at display time.
   */
  dailyCalories: number;
  /** What an average day shows — base plus expected movement, floored like home. */
  effectiveDailyCalories: number;
  /** Floor for the displayed goal (0.85 × BMR, never below the hard minimum). */
  minimumCalories: number;
  cappedToMaxTdeeAdjustment: boolean;
  /** True when the floor had to lift the displayed goal. */
  clampedToMinimum: boolean;
};

/** Hard range check shared by onboarding custom/summary and settings calorie goal. */
export function isValidDailyCalorieGoalInput(calories: number): boolean {
  return (
    Number.isFinite(calories) &&
    calories >= HARD_MINIMUM_DAILY_CALORIES &&
    calories <= MAXIMUM_DAILY_CALORIES
  );
}

export function getMaxDailyCalorieAdjustment(maintenanceCalories: number): number {
  return maintenanceCalories * MAX_TDEE_ADJUSTMENT_FRACTION;
}

/**
 * Soft warning only (does not block save). True when calories sit outside
 * ~70%–130% of estimated maintenance. No warning when maintenance is unknown.
 *
 * Both arguments must describe the same day: pass the displayed goal against
 * expected maintenance, never the BMR-based base against a TDEE-based figure.
 */
export function isCalorieGoalFarFromTdee(
  calories: number,
  maintenanceCalories: number | null | undefined,
): boolean {
  if (maintenanceCalories == null || !(maintenanceCalories > 0) || !(calories > 0)) {
    return false;
  }

  const lowerBound = maintenanceCalories * (1 - WARNING_TDEE_DEVIATION_FRACTION);
  const upperBound = maintenanceCalories * (1 + WARNING_TDEE_DEVIATION_FRACTION);
  return calories < lowerBound || calories > upperBound;
}

export function calculateAge(birthDate: Date): number {
  return calculateAgeMath(birthDate);
}

export function calculateBmr(params: {
  biologicalSex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  return calculateBmrMath(params);
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return calculateTdeeMath(bmr, activityLevel);
}

export function calculateMaintenanceCalories(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  observedMaintenanceKcal?: number;
}): number {
  return calculateMaintenanceCaloriesMath(params);
}

/** BMR + mean active energy under HEALTH, else the stored maintenance. */
export function resolveExpectedMaintenance(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  maintenanceCalories: number;
  recentActiveEnergy?: RecentActiveEnergy | null;
}): number {
  return resolveExpectedMaintenanceKcalMath({
    calorieSource: params.calorieSource,
    bmr: calculateBmr({
      biologicalSex: params.biologicalSex,
      weightKg: params.weightKg,
      heightCm: params.heightCm,
      age: calculateAge(params.birthDate),
    }),
    activityLevel: params.activityLevel,
    maintenanceCalories: params.maintenanceCalories,
    recentActiveEnergy: params.recentActiveEnergy,
  });
}

export function calculateUncappedDailyCalorieAdjustment(
  weightKg: number,
  percentPerWeek: number,
): number {
  return calculateUncappedDailyCalorieAdjustmentMath(weightKg, percentPerWeek);
}

function capDailyCalorieAdjustment(
  adjustment: number,
  maintenanceCalories: number,
): { adjustment: number; wasCapped: boolean } {
  const maxAdjustment = getMaxDailyCalorieAdjustment(maintenanceCalories);

  if (adjustment > maxAdjustment) {
    return { adjustment: maxAdjustment, wasCapped: true };
  }

  return { adjustment, wasCapped: false };
}

function getGoalCalorieDirection(goalType: GoalType): 'loss' | 'gain' | 'none' {
  switch (goalType) {
    case 'lose_weight':
    case 'faster_weight_loss':
      return 'loss';
    case 'gain_weight':
      return 'gain';
    default:
      return 'none';
  }
}

function calculatePredefinedGoalCalories(params: {
  weightKg: number;
  maintenanceCalories: number;
  goalType: Exclude<GoalType, 'custom'>;
  /** Cap reference — the expected day, not the base being adjusted. */
  expectedMaintenanceKcal?: number;
}): {
  uncappedDailyCalorieAdjustment: number;
  dailyCalorieAdjustment: number;
  rawCalories: number;
  cappedToMaxTdeeAdjustment: boolean;
} {
  const { weightKg, maintenanceCalories, goalType } = params;
  const percentPerWeek = GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK[goalType];
  const uncappedDailyCalorieAdjustment = calculateUncappedDailyCalorieAdjustment(
    weightKg,
    percentPerWeek,
  );
  const { adjustment: dailyCalorieAdjustment, wasCapped } = capDailyCalorieAdjustment(
    uncappedDailyCalorieAdjustment,
    params.expectedMaintenanceKcal ?? maintenanceCalories,
  );
  const direction = getGoalCalorieDirection(goalType);

  let rawCalories = maintenanceCalories;
  if (direction === 'loss') {
    rawCalories = Math.round(maintenanceCalories - dailyCalorieAdjustment);
  } else if (direction === 'gain') {
    rawCalories = Math.round(maintenanceCalories + dailyCalorieAdjustment);
  }

  return {
    uncappedDailyCalorieAdjustment,
    dailyCalorieAdjustment,
    rawCalories,
    cappedToMaxTdeeAdjustment: wasCapped,
  };
}

function calculateRawDailyCalorieGoal(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  goalType: GoalType;
  customCalorieGoal?: number | null;
  recentActiveEnergy?: RecentActiveEnergy | null;
}): { rawCalories: number; maintenanceCalories: number } {
  const maintenanceCalories = calculateMaintenanceCalories(params);

  if (params.goalType === 'custom') {
    return {
      rawCalories: Math.round(params.customCalorieGoal ?? maintenanceCalories),
      maintenanceCalories,
    };
  }

  return {
    rawCalories: calculatePredefinedGoalCalories({
      weightKg: params.weightKg,
      maintenanceCalories,
      goalType: params.goalType,
      expectedMaintenanceKcal: resolveExpectedMaintenance({
        ...params,
        maintenanceCalories,
      }),
    }).rawCalories,
    maintenanceCalories,
  };
}

export function calculateDailyCalorieGoal(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  goalType: GoalType;
  customCalorieGoal?: number | null;
  recentActiveEnergy?: RecentActiveEnergy | null;
}): { dailyCalorieGoal: number; maintenanceCalories: number } {
  const { rawCalories, maintenanceCalories } = calculateRawDailyCalorieGoal(params);
  // Stored base only — the resting-metabolism floor belongs on the displayed
  // goal, so applying it here would inflate what HEALTH adds active energy to.
  return {
    dailyCalorieGoal: Math.max(rawCalories, HARD_MINIMUM_DAILY_CALORIES),
    maintenanceCalories,
  };
}

export function calculateDailyCalorieGoalDetails(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  goalType: GoalType;
  customCalorieGoal?: number | null;
  recentActiveEnergy?: RecentActiveEnergy | null;
}): CalorieGoalCalculation {
  const bmr = Math.round(
    calculateBmr({
      biologicalSex: params.biologicalSex,
      weightKg: params.weightKg,
      heightCm: params.heightCm,
      age: calculateAge(params.birthDate),
    }),
  );
  const maintenanceCalories = calculateMaintenanceCalories(params);
  const expectedMaintenanceKcal = resolveExpectedMaintenance({
    ...params,
    maintenanceCalories,
  });
  // Under HEALTH the base is BMR-derived, so the expected day adds the movement
  // that expected maintenance already accounts for. Other sources embed it.
  const expectedActiveEnergyKcal =
    params.calorieSource === CalorieSource.HEALTH
      ? Math.max(0, expectedMaintenanceKcal - bmr)
      : 0;
  const minimumCalories = resolveDailyGoalFloor(bmr);

  const resolveDisplayed = (baseDailyGoal: number) =>
    resolveEffectiveDailyCalorieGoal({
      calorieSource: params.calorieSource,
      baseDailyGoal,
      activeEnergyBurnedKcal: expectedActiveEnergyKcal,
      bmr,
    });

  if (params.goalType === 'custom') {
    const rawCalories = Math.round(params.customCalorieGoal ?? maintenanceCalories);
    const dailyCalories = Math.max(rawCalories, HARD_MINIMUM_DAILY_CALORIES);
    const effectiveDailyCalories = resolveDisplayed(dailyCalories);

    return {
      bmr,
      maintenanceCalories,
      expectedMaintenanceKcal,
      expectedActiveEnergyKcal,
      uncappedDailyCalorieAdjustment: 0,
      dailyCalorieAdjustment: 0,
      rawCalories,
      dailyCalories,
      effectiveDailyCalories,
      minimumCalories,
      cappedToMaxTdeeAdjustment: false,
      clampedToMinimum:
        effectiveDailyCalories > dailyCalories + expectedActiveEnergyKcal,
    };
  }

  const predefined = calculatePredefinedGoalCalories({
    weightKg: params.weightKg,
    maintenanceCalories,
    goalType: params.goalType,
    expectedMaintenanceKcal,
  });
  const dailyCalories = Math.max(predefined.rawCalories, HARD_MINIMUM_DAILY_CALORIES);
  const effectiveDailyCalories = resolveDisplayed(dailyCalories);

  return {
    bmr,
    maintenanceCalories,
    expectedMaintenanceKcal,
    expectedActiveEnergyKcal,
    uncappedDailyCalorieAdjustment: predefined.uncappedDailyCalorieAdjustment,
    dailyCalorieAdjustment: predefined.dailyCalorieAdjustment,
    rawCalories: predefined.rawCalories,
    dailyCalories,
    effectiveDailyCalories,
    minimumCalories,
    cappedToMaxTdeeAdjustment: predefined.cappedToMaxTdeeAdjustment,
    clampedToMinimum:
      effectiveDailyCalories > dailyCalories + expectedActiveEnergyKcal,
  };
}
