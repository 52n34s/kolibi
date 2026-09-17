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
  type ActivityLevel as ActivityLevelMath,
  type BiologicalSex as BiologicalSexMath,
  type GoalType as GoalTypeMath,
} from '@/lib/calorie-goal-math';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import { localDateKey } from '@/lib/day-window';
import { suggestInitialTargetWeightKg } from '@/lib/macro-goals';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { upsertTodayWeightLog } from '@/lib/weight-logs';

export type BiologicalSex = BiologicalSexMath;
export type ActivityLevel = ActivityLevelMath;
export type GoalType = GoalTypeMath;
export type CalorieGoalSource = 'calculated' | 'custom';
export { CalorieSource, resolveCalorieSource };

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
  maintenanceCalories: number;
  uncappedDailyCalorieAdjustment: number;
  dailyCalorieAdjustment: number;
  rawCalories: number;
  dailyCalories: number;
  minimumCalories: number;
  cappedToMaxTdeeAdjustment: boolean;
  clampedToMinimum: boolean;
};

export function getMinimumDailyCalories(_biologicalSex?: BiologicalSex): number {
  return HARD_MINIMUM_DAILY_CALORIES;
}

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

function calculateRawDailyCalorieGoal(params: {
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  calorieSource: CalorieSource;
  goalType: GoalType;
  customCalorieGoal?: number | null;
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
}): { dailyCalorieGoal: number; maintenanceCalories: number } {
  const { rawCalories, maintenanceCalories } = calculateRawDailyCalorieGoal(params);
  return {
    dailyCalorieGoal: Math.max(rawCalories, getMinimumDailyCalories(params.biologicalSex)),
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

const PROFILE_RACE_RETRY_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadOnboardingProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('onboarded_at, target_weight_kg')
    .eq('id', userId)
    .maybeSingle();
}

/**
 * Missing profile row: confirm via getUser(). Deleted auth user → new anonymous session.
 * Existing user (handle_new_user race) → wait once and retry. Network → do not recover.
 */
async function resolveOnboardingProfile(userId: string): Promise<{
  userId: string;
  onboardedAt: string | null;
  targetWeightKg: number | null;
}> {
  const first = await loadOnboardingProfile(userId);
  if (first.error) {
    throw first.error;
  }

  if (first.data) {
    return {
      userId,
      onboardedAt: first.data.onboarded_at,
      targetWeightKg: parseTargetWeightKg(first.data.target_weight_kg),
    };
  }

  const outcome = await useAuthStore.getState().recoverSessionIfUserMissing();

  if (outcome === 'recovered') {
    const nextId = useAuthStore.getState().session?.user?.id;
    if (!nextId) {
      throw new Error('Profile not found while skipping onboarding.');
    }

    await delay(PROFILE_RACE_RETRY_MS);
    const second = await loadOnboardingProfile(nextId);
    if (second.error) {
      throw second.error;
    }

    if (second.data) {
      return {
        userId: nextId,
        onboardedAt: second.data.onboarded_at,
        targetWeightKg: parseTargetWeightKg(second.data.target_weight_kg),
      };
    }
  }

  if (outcome === 'user_exists') {
    await delay(PROFILE_RACE_RETRY_MS);
    const second = await loadOnboardingProfile(userId);
    if (second.error) {
      throw second.error;
    }

    if (second.data) {
      return {
        userId,
        onboardedAt: second.data.onboarded_at,
        targetWeightKg: parseTargetWeightKg(second.data.target_weight_kg),
      };
    }
  }

  throw new Error('Profile not found while skipping onboarding.');
}

function parseTargetWeightKg(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function skipOnboarding(userId: string, dietPreference: string | null = null) {
  const now = new Date().toISOString();
  const resolved = await resolveOnboardingProfile(userId);
  userId = resolved.userId;
  const existing = { onboarded_at: resolved.onboardedAt };

  // Already set — leave untouched (fine).
  if (existing.onboarded_at) {
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarded_at: now, diet_preference: dietPreference })
    .eq('id', userId)
    .is('onboarded_at', null)
    .select('id, onboarded_at, diet_preference')
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Expected a write. Empty result with no error usually means RLS or a race.
  if (!data?.onboarded_at) {
    const { data: again, error: againError } = await supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('id', userId)
      .maybeSingle();

    if (againError) {
      throw againError;
    }

    // Concurrent writer set it — fine.
    if (again?.onboarded_at) {
      return;
    }

    const retried = await resolveOnboardingProfile(userId);
    if (retried.onboardedAt) {
      return;
    }

    throw new Error('Failed to set onboarded_at (no row updated).');
  }
}

export async function completeOnboarding(
  userId: string,
  data: {
    dietPreference: string | null;
    biologicalSex: BiologicalSex;
    birthDate: Date;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
    goalType: GoalType;
    calorieGoalSource: CalorieGoalSource;
    dailyCalorieGoal: number;
    tdee?: number | null;
  },
) {
  const now = new Date().toISOString();
  const resolved = await resolveOnboardingProfile(userId);
  userId = resolved.userId;
  const existingProfile = {
    onboarded_at: resolved.onboardedAt,
    target_weight_kg: resolved.targetWeightKg,
  };

  const profilePayload: {
    diet_preference: string | null;
    birth_date: string;
    biological_sex: BiologicalSex;
    height_cm: number;
    activity_level: ActivityLevel;
    goal_type: GoalType;
    calorie_goal_source: CalorieGoalSource;
    onboarded_at?: string;
    target_weight_kg?: number;
  } = {
    diet_preference: data.dietPreference,
    birth_date: localDateKey(data.birthDate),
    biological_sex: data.biologicalSex,
    height_cm: data.heightCm,
    activity_level: data.activityLevel,
    goal_type: data.goalType,
    calorie_goal_source: data.calorieGoalSource,
  };

  // Only set onboarded_at when currently null — leave an existing value untouched.
  if (!existingProfile?.onboarded_at) {
    profilePayload.onboarded_at = now;
  }

  // Only seed target weight when unset — never overwrite a user-set value.
  if (existingProfile.target_weight_kg == null) {
    profilePayload.target_weight_kg = suggestInitialTargetWeightKg({
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      goalType: data.goalType,
    });
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
    .select('id, onboarded_at, biological_sex')
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  // Update with no error but no row usually means RLS / missing profile.
  if (!profileData) {
    const retried = await resolveOnboardingProfile(userId);
    if (retried.userId !== userId) {
      userId = retried.userId;
    }

    const { data: retryData, error: retryError } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', userId)
      .select('id, onboarded_at, biological_sex')
      .maybeSingle();

    if (retryError) {
      throw retryError;
    }

    if (!retryData) {
      throw new Error('Failed to update profile (no row returned).');
    }
  }

  await upsertTodayWeightLog({
    userId,
    weightKg: data.weightKg,
    source: 'manual',
  });

  await upsertDailyCalorieGoal({
    userId,
    dailyCalorieGoal: data.dailyCalorieGoal,
    source: data.calorieGoalSource,
    tdee: data.tdee,
  });
}
