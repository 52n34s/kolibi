/**
 * Exclusive calorie-goal sources: observed expenditure, HealthKit active energy,
 * or activity multiplier — never combine observed/activity with Health AE.
 * Const object (not TS `enum`) so Node strip-types / unit tests can import this module.
 */
export const CalorieSource = {
  HEALTH: 'health',
  ACTIVITY_FACTOR: 'activity_factor',
  /** Measured maintenance from intake + weight change; no active-energy add-on. */
  OBSERVED: 'observed',
} as const;

export type CalorieSource = (typeof CalorieSource)[keyof typeof CalorieSource];

export type ActivityLevel = 'mostly_sitting' | 'lightly_active' | 'active' | 'very_active';

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

export type GoalType =
  | 'maintain'
  | 'lose_weight'
  | 'gain_weight'
  | 'build_muscle'
  /** Kraft und Skills: same calorie/macro effect as build_muscle. */
  | 'strength'
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
  /** Recomposition: muscle macros at maintenance, so no planned weight change. */
  build_muscle: 0,
  /** Same as build_muscle: maintenance calories. */
  strength: 0,
  endurance: 0,
} as const satisfies Record<Exclude<GoalType, 'custom'>, number>;

export function resolveCalorieSource(
  healthConnected: boolean,
  options?: { observedReady?: boolean },
): CalorieSource {
  if (options?.observedReady) {
    return CalorieSource.OBSERVED;
  }
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
 * OBSERVED → measured expenditure (required via observedMaintenanceKcal).
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
  /** Required when calorieSource is OBSERVED. */
  observedMaintenanceKcal?: number;
  today?: Date;
}): number {
  if (params.calorieSource === CalorieSource.OBSERVED) {
    return Math.round(params.observedMaintenanceKcal ?? 0);
  }

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

/** Window for the active-energy mean behind expected maintenance. */
export const EXPECTED_MAINTENANCE_AE_WINDOW_DAYS = 14;
/** Below this many days with Health data the activity factor stands in. */
export const EXPECTED_MAINTENANCE_AE_MIN_DAYS = 7;

export type RecentActiveEnergy = {
  /** Mean active energy per day across the window. */
  avgKcal: number;
  /** Days with Health data inside the window. */
  days: number;
};

/**
 * What the user burns on an average day — the reference the deficit cap is
 * measured against.
 *
 * HEALTH stores BMR as maintenance because active energy only joins at display
 * time. Capping the deficit against that would size it off resting metabolism
 * and bind far too early, so the expected day is reconstructed here instead.
 */
export function resolveExpectedMaintenanceKcal(params: {
  calorieSource: CalorieSource;
  bmr: number;
  activityLevel: ActivityLevel;
  maintenanceCalories: number;
  recentActiveEnergy?: RecentActiveEnergy | null;
}): number {
  if (params.calorieSource !== CalorieSource.HEALTH) {
    return params.maintenanceCalories;
  }

  const recent = params.recentActiveEnergy;
  if (
    recent != null &&
    recent.days >= EXPECTED_MAINTENANCE_AE_MIN_DAYS &&
    recent.avgKcal > 0
  ) {
    return Math.round(params.bmr + recent.avgKcal);
  }

  return Math.round(calculateTdee(params.bmr, params.activityLevel));
}

/**
 * A moderate deficit below resting metabolism is normal for a sedentary day —
 * an activity-factor deficit lands at 0.9 × BMR and must stay untouched. This
 * only catches the collapse: a target built off the BMR with no activity in it.
 */
export const DAILY_GOAL_FLOOR_BMR_FRACTION = 0.85;

/** Lower bound for a displayed target. */
export function resolveDailyGoalFloor(bmr?: number | null): number {
  if (bmr == null || !(bmr > 0)) {
    return HARD_MINIMUM_DAILY_CALORIES;
  }
  return Math.max(
    Math.round(bmr * DAILY_GOAL_FLOOR_BMR_FRACTION),
    HARD_MINIMUM_DAILY_CALORIES,
  );
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
  /** Cap reference — the expected day, not the base being adjusted. */
  expectedMaintenanceKcal?: number;
}): number {
  const percentPerWeek = GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK[params.goalType];
  const uncapped = calculateUncappedDailyCalorieAdjustment(params.weightKg, percentPerWeek);
  const dailyCalorieAdjustment = capDailyCalorieAdjustment(
    uncapped,
    params.expectedMaintenanceKcal ?? params.maintenanceCalories,
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
 * ACTIVITY_FACTOR and OBSERVED ignore activeEnergyBurnedKcal (no double-counting;
 * observed already embeds real-world activity).
 */
export function resolveEffectiveDailyCalorieGoal(params: {
  calorieSource: CalorieSource;
  baseDailyGoal: number;
  activeEnergyBurnedKcal: number;
  /** Applies the resting-metabolism floor. Omit only where BMR is unknown. */
  bmr?: number | null;
}): number {
  const withActiveEnergy = (): number => {
    switch (params.calorieSource) {
      case CalorieSource.HEALTH:
        return params.baseDailyGoal + Math.max(0, params.activeEnergyBurnedKcal);
      case CalorieSource.ACTIVITY_FACTOR:
      case CalorieSource.OBSERVED:
        return params.baseDailyGoal;
      default: {
        const _exhaustive: never = params.calorieSource;
        return _exhaustive;
      }
    }
  };

  return Math.max(withActiveEnergy(), resolveDailyGoalFloor(params.bmr));
}

export type DailyCalorieGoalBreakdown = {
  calorieSource: CalorieSource;
  bmr: number;
  maintenanceCalories: number;
  /** Cap reference — BMR + mean active energy under HEALTH. */
  expectedMaintenanceKcal: number;
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
  observedMaintenanceKcal?: number;
  recentActiveEnergy?: RecentActiveEnergy | null;
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
  const expectedMaintenanceKcal = resolveExpectedMaintenanceKcal({
    calorieSource: params.calorieSource,
    bmr,
    activityLevel: params.activityLevel,
    maintenanceCalories,
    recentActiveEnergy: params.recentActiveEnergy,
  });
  const adjusted = applyGoalAdjustment({
    weightKg: params.weightKg,
    maintenanceCalories,
    goalType: params.goalType,
    expectedMaintenanceKcal,
  });
  const baseDailyGoal = Math.max(adjusted, HARD_MINIMUM_DAILY_CALORIES);
  const activeEnergyBurnedKcal = Math.max(0, params.activeEnergyBurnedKcal ?? 0);
  const effectiveDailyGoal = resolveEffectiveDailyCalorieGoal({
    calorieSource: params.calorieSource,
    baseDailyGoal,
    activeEnergyBurnedKcal,
    bmr,
  });

  return {
    calorieSource: params.calorieSource,
    bmr: Math.round(bmr),
    maintenanceCalories,
    expectedMaintenanceKcal,
    baseDailyGoal,
    activeEnergyBurnedKcal,
    effectiveDailyGoal,
  };
}
