import { supabase } from '@/lib/supabase';
import { upsertTodayWeightLog } from '@/lib/weight-logs';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';
export type ActivityLevel = 'mostly_sitting' | 'lightly_active' | 'active' | 'very_active';
export type GoalType =
  | 'maintain'
  | 'lose_weight'
  | 'gain_weight'
  | 'faster_weight_loss'
  | 'custom';
export type CalorieGoalSource = 'calculated' | 'custom';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  mostly_sitting: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

export const MINIMUM_DAILY_CALORIES = {
  female: 1200,
  male: 1500,
  prefer_not_to_say: 1500,
} as const satisfies Record<BiologicalSex, number>;

export const KCAL_PER_KG_BODY_WEIGHT = 7700;
export const DAYS_PER_WEEK = 7;
export const MAX_TDEE_ADJUSTMENT_FRACTION = 0.25;
/** Slightly wider than the adjustment cap so predefined goals never self-trigger warnings. */
export const WARNING_TDEE_DEVIATION_FRACTION = 0.3;

/** Target body-weight change rate per week (% of current body weight). */
export const GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK = {
  maintain: 0,
  lose_weight: 0.5,
  faster_weight_loss: 0.75,
  gain_weight: 0.375,
} as const satisfies Record<Exclude<GoalType, 'custom'>, number>;

export const GOAL_WEIGHT_CHANGE_PERCENT_RANGES = {
  gain_weight: { min: 0.25, max: 0.5 },
} as const;

export type CalorieGoalCalculation = {
  maintenanceCalories: number;
  uncappedDailyCalorieAdjustment: number;
  dailyCalorieAdjustment: number;
  rawCalories: number;
  dailyCalories: number;
  minimumCalories: number;
  cappedToMaxTdeeAdjustment: boolean;
  clampedToMinimum: boolean;
};

export function getMinimumDailyCalories(biologicalSex: BiologicalSex): number {
  return MINIMUM_DAILY_CALORIES[biologicalSex];
}

export function getMaxDailyCalorieAdjustment(maintenanceCalories: number): number {
  return maintenanceCalories * MAX_TDEE_ADJUSTMENT_FRACTION;
}

export function isCalorieGoalFarFromTdee(
  calories: number,
  maintenanceCalories: number,
): boolean {
  const lowerBound = maintenanceCalories * (1 - WARNING_TDEE_DEVIATION_FRACTION);
  const upperBound = maintenanceCalories * (1 + WARNING_TDEE_DEVIATION_FRACTION);
  return calories < lowerBound || calories > upperBound;
}

export function calculateUncappedDailyCalorieAdjustment(
  weightKg: number,
  percentPerWeek: number,
): number {
  const weeklyWeightChangeKg = weightKg * (percentPerWeek / 100);
  return (weeklyWeightChangeKg * KCAL_PER_KG_BODY_WEIGHT) / DAYS_PER_WEEK;
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
    maintenanceCalories,
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

export type OnboardingFormData = {
  biologicalSex: BiologicalSex | null;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goalType: GoalType | null;
  customCalorieGoal: number | null;
  dailyCalorieGoal: number | null;
};

export function formatAppDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function calculateAge(birthDate: Date): number {
  const today = new Date();
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

export function calculateMaintenanceCalories(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}): number {
  const age = calculateAge(params.birthDate);
  const bmr = calculateBmr({
    biologicalSex: params.biologicalSex,
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    age,
  });

  return Math.round(calculateTdee(bmr, params.activityLevel));
}

function calculateRawDailyCalorieGoal(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  customCalorieGoal?: number | null;
}): number {
  const maintenanceCalories = calculateMaintenanceCalories(params);

  if (params.goalType === 'custom') {
    return Math.round(params.customCalorieGoal ?? maintenanceCalories);
  }

  return calculatePredefinedGoalCalories({
    weightKg: params.weightKg,
    maintenanceCalories,
    goalType: params.goalType,
  }).rawCalories;
}

export function calculateDailyCalorieGoal(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  customCalorieGoal?: number | null;
}): number {
  const rawCalories = calculateRawDailyCalorieGoal(params);
  return Math.max(rawCalories, getMinimumDailyCalories(params.biologicalSex));
}

export function calculateDailyCalorieGoalDetails(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  customCalorieGoal?: number | null;
}): CalorieGoalCalculation {
  const maintenanceCalories = calculateMaintenanceCalories(params);
  const minimumCalories = getMinimumDailyCalories(params.biologicalSex);

  if (params.goalType === 'custom') {
    const rawCalories = Math.round(params.customCalorieGoal ?? maintenanceCalories);
    const dailyCalories = Math.max(rawCalories, minimumCalories);

    return {
      maintenanceCalories,
      uncappedDailyCalorieAdjustment: 0,
      dailyCalorieAdjustment: 0,
      rawCalories,
      dailyCalories,
      minimumCalories,
      cappedToMaxTdeeAdjustment: false,
      clampedToMinimum: rawCalories < minimumCalories,
    };
  }

  const predefined = calculatePredefinedGoalCalories({
    weightKg: params.weightKg,
    maintenanceCalories,
    goalType: params.goalType,
  });
  const dailyCalories = Math.max(predefined.rawCalories, minimumCalories);

  return {
    maintenanceCalories,
    uncappedDailyCalorieAdjustment: predefined.uncappedDailyCalorieAdjustment,
    dailyCalorieAdjustment: predefined.dailyCalorieAdjustment,
    rawCalories: predefined.rawCalories,
    dailyCalories,
    minimumCalories,
    cappedToMaxTdeeAdjustment: predefined.cappedToMaxTdeeAdjustment,
    clampedToMinimum: predefined.rawCalories < minimumCalories,
  };
}

export async function skipOnboarding(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function completeOnboarding(
  userId: string,
  data: {
    biologicalSex: BiologicalSex;
    birthDate: Date;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
    goalType: GoalType;
    calorieGoalSource: CalorieGoalSource;
    dailyCalorieGoal: number;
  },
) {
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      birth_date: data.birthDate.toISOString().split('T')[0],
      biological_sex: data.biologicalSex,
      height_cm: data.heightCm,
      activity_level: data.activityLevel,
      goal_type: data.goalType,
      calorie_goal_source: data.calorieGoalSource,
      onboarded_at: now,
    })
    .eq('id', userId);

  if (profileError) {
    throw profileError;
  }

  await upsertTodayWeightLog({
    userId,
    weightKg: data.weightKg,
    source: 'manual',
  });

  await upsertDailyCalorieGoal({
    userId,
    dailyCalorieGoal: data.dailyCalorieGoal,
  });
}
