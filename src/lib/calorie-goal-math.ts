/**
 * Exclusive calorie-goal sources: activity multiplier OR HealthKit active energy — never both.
 * Const object (not TS `enum`) so Node strip-types / unit tests can import this module.
 */
export const CalorieSource = {
  HEALTH: 'health',
  ACTIVITY_FACTOR: 'activity_factor',
} as const;

export type CalorieSource = (typeof CalorieSource)[keyof typeof CalorieSource];

export type ActivityLevel = 'mostly_sitting' | 'lightly_active' | 'active' | 'very_active';

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

export type GoalType =
  | 'maintain'
  | 'lose_weight'
  | 'gain_weight'
  | 'faster_weight_loss'
  | 'endurance'
  | 'custom';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  mostly_sitting: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

export const HARD_MINIMUM_DAILY_CALORIES = 1000;
export const KCAL_PER_KG_BODY_WEIGHT = 7700;
export const DAYS_PER_WEEK = 7;
export const MAX_TDEE_ADJUSTMENT_FRACTION = 0.25;

export const GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK = {
  maintain: 0,
  lose_weight: 0.5,
  faster_weight_loss: 0.75,
  gain_weight: 0.375,
  endurance: 0,
} as const satisfies Record<Exclude<GoalType, 'custom'>, number>;

export function resolveCalorieSource(healthConnected: boolean): CalorieSource {
  return healthConnected ? CalorieSource.HEALTH : CalorieSource.ACTIVITY_FACTOR;
}

export function calculateAge(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export function calculateBmr(params: {
  biologicalSex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const { biologicalSex, weightKg, heightCm, age } = params;
  const maleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const femaleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  if (biologicalSex === 'male') {
    return maleBmr;
  }

  if (biologicalSex === 'female') {
    return femaleBmr;
  }

  return (maleBmr + femaleBmr) / 2;
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

/**
 * Maintenance calories for the stored base goal.
 * HEALTH → pure BMR (active energy is added later at display time).
 * ACTIVITY_FACTOR → BMR × onboarding activity multiplier.
 */
export function calculateMaintenanceCalories(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  today?: Date;
}): number {
  const age = calculateAge(params.birthDate, params.today);
  const bmr = calculateBmr({
    biologicalSex: params.biologicalSex,
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    age,
  });

  switch (params.calorieSource) {
    case CalorieSource.HEALTH:
      return Math.round(bmr);
    case CalorieSource.ACTIVITY_FACTOR:
      return Math.round(calculateTdee(bmr, params.activityLevel));
    default: {
      const _exhaustive: never = params.calorieSource;
      return _exhaustive;
    }
  }
}

export function calculateUncappedDailyCalorieAdjustment(
  weightKg: number,
  percentPerWeek: number,
): number {
  const weeklyWeightChangeKg = weightKg * (percentPerWeek / 100);
  return (weeklyWeightChangeKg * KCAL_PER_KG_BODY_WEIGHT) / DAYS_PER_WEEK;
}

function getMaxDailyCalorieAdjustment(maintenanceCalories: number): number {
  return maintenanceCalories * MAX_TDEE_ADJUSTMENT_FRACTION;
}

function capDailyCalorieAdjustment(
  adjustment: number,
  maintenanceCalories: number,
): number {
  const maxAdjustment = getMaxDailyCalorieAdjustment(maintenanceCalories);
  return adjustment > maxAdjustment ? maxAdjustment : adjustment;
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

export function applyGoalAdjustment(params: {
  weightKg: number;
  maintenanceCalories: number;
  goalType: Exclude<GoalType, 'custom'>;
}): number {
  const percentPerWeek = GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK[params.goalType];
  const uncapped = calculateUncappedDailyCalorieAdjustment(params.weightKg, percentPerWeek);
  const dailyCalorieAdjustment = capDailyCalorieAdjustment(
    uncapped,
    params.maintenanceCalories,
  );
  const direction = getGoalCalorieDirection(params.goalType);

  if (direction === 'loss') {
    return Math.round(params.maintenanceCalories - dailyCalorieAdjustment);
  }
  if (direction === 'gain') {
    return Math.round(params.maintenanceCalories + dailyCalorieAdjustment);
  }
  return params.maintenanceCalories;
}

/**
 * Applies active energy only for CalorieSource.HEALTH.
 * ACTIVITY_FACTOR ignores activeEnergyBurnedKcal even if > 0 (guards against double-counting).
 */
export function resolveEffectiveDailyCalorieGoal(params: {
  calorieSource: CalorieSource;
  baseDailyGoal: number;
  activeEnergyBurnedKcal: number;
}): number {
  switch (params.calorieSource) {
    case CalorieSource.HEALTH:
      return params.baseDailyGoal + Math.max(0, params.activeEnergyBurnedKcal);
    case CalorieSource.ACTIVITY_FACTOR:
      return params.baseDailyGoal;
    default: {
      const _exhaustive: never = params.calorieSource;
      return _exhaustive;
    }
  }
}

export type DailyCalorieGoalBreakdown = {
  calorieSource: CalorieSource;
  bmr: number;
  maintenanceCalories: number;
  baseDailyGoal: number;
  activeEnergyBurnedKcal: number;
  effectiveDailyGoal: number;
};

/**
 * Full pipeline for tests and call sites that need an explicit source switch.
 * Never multiplies by an activity factor and adds Health active energy in the same path.
 */
export function calculateDailyCalorieGoalForSource(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  goalType: Exclude<GoalType, 'custom'>;
  activeEnergyBurnedKcal?: number;
  today?: Date;
}): DailyCalorieGoalBreakdown {
  const age = calculateAge(params.birthDate, params.today);
  const bmr = calculateBmr({
    biologicalSex: params.biologicalSex,
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    age,
  });

  const maintenanceCalories = calculateMaintenanceCalories(params);
  const adjusted = applyGoalAdjustment({
    weightKg: params.weightKg,
    maintenanceCalories,
    goalType: params.goalType,
  });
  const baseDailyGoal = Math.max(adjusted, HARD_MINIMUM_DAILY_CALORIES);
  const activeEnergyBurnedKcal = Math.max(0, params.activeEnergyBurnedKcal ?? 0);
  const effectiveDailyGoal = resolveEffectiveDailyCalorieGoal({
    calorieSource: params.calorieSource,
    baseDailyGoal,
    activeEnergyBurnedKcal,
  });

  return {
    calorieSource: params.calorieSource,
    bmr: Math.round(bmr),
    maintenanceCalories,
    baseDailyGoal,
    activeEnergyBurnedKcal,
    effectiveDailyGoal,
  };
}
