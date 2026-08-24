import { supabase } from '@/lib/supabase';
import { upsertTodayWeightLog } from '@/lib/weight-logs';
import { localDateKey } from '@/lib/day-window';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import { useAuthStore } from '@/stores/auth-store';

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

/** Sedentary baseline when HealthKit supplies actual active energy at runtime. */
export const HEALTHKIT_ACTIVITY_LEVEL: ActivityLevel = 'mostly_sitting';

export function resolveActivityLevelForCalorieGoal(
  activityLevel: ActivityLevel,
  healthConnected: boolean,
): ActivityLevel {
  return healthConnected ? HEALTHKIT_ACTIVITY_LEVEL : activityLevel;
}

export const HARD_MINIMUM_DAILY_CALORIES = 1000;
export const MAXIMUM_DAILY_CALORIES = 6000;

export const KCAL_PER_KG_BODY_WEIGHT = 7700;
export const DAYS_PER_WEEK = 7;
export const MAX_TDEE_ADJUSTMENT_FRACTION = 0.25;
/** Soft warning band around maintenance (±30% ≈ below ~70% or above ~130% of TDEE). Save still allowed. */
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

const PROFILE_RACE_RETRY_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadOnboardingProfile(userId: string) {
  return supabase.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle();
}

/**
 * Missing profile row: confirm via getUser(). Deleted auth user → new anonymous session.
 * Existing user (handle_new_user race) → wait once and retry. Network → do not recover.
 */
async function resolveOnboardingProfile(userId: string): Promise<{
  userId: string;
  onboardedAt: string | null;
}> {
  const first = await loadOnboardingProfile(userId);
  if (first.error) {
    throw first.error;
  }

  if (first.data) {
    return { userId, onboardedAt: first.data.onboarded_at };
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
      return { userId: nextId, onboardedAt: second.data.onboarded_at };
    }
  }

  if (outcome === 'user_exists') {
    await delay(PROFILE_RACE_RETRY_MS);
    const second = await loadOnboardingProfile(userId);
    if (second.error) {
      throw second.error;
    }

    if (second.data) {
      return { userId, onboardedAt: second.data.onboarded_at };
    }
  }

  throw new Error('Profile not found while skipping onboarding.');
}

export async function skipOnboarding(userId: string, dietPreference: string | null = null) {
  const now = new Date().toISOString();
  const resolved = await resolveOnboardingProfile(userId);
  userId = resolved.userId;
  console.log('[onboarding] skipOnboarding before update', { userId, now, dietPreference });

  const existing = { onboarded_at: resolved.onboardedAt };

  // Already set — leave untouched (fine).
  if (existing.onboarded_at) {
    console.log('[onboarding] skipOnboarding noop: onboarded_at already set');
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarded_at: now, diet_preference: dietPreference })
    .eq('id', userId)
    .is('onboarded_at', null)
    .select('id, onboarded_at, diet_preference')
    .maybeSingle();

  console.log('[onboarding] skipOnboarding after update', { data, error });

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
  },
) {
  const now = new Date().toISOString();
  const resolved = await resolveOnboardingProfile(userId);
  userId = resolved.userId;
  const existingProfile = { onboarded_at: resolved.onboardedAt };

  const profilePayload: {
    diet_preference: string | null;
    birth_date: string;
    biological_sex: BiologicalSex;
    height_cm: number;
    activity_level: ActivityLevel;
    goal_type: GoalType;
    calorie_goal_source: CalorieGoalSource;
    onboarded_at?: string;
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

  console.log('[onboarding] completeOnboarding before profile update', {
    userId,
    profilePayload,
  });

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
    .select('id, onboarded_at, biological_sex')
    .maybeSingle();

  console.log('[onboarding] completeOnboarding after profile update', {
    data: profileData,
    error: profileError,
  });

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

  try {
    console.log('[onboarding] completeOnboarding before weight upsert', {
      userId,
      weightKg: data.weightKg,
    });
    await upsertTodayWeightLog({
      userId,
      weightKg: data.weightKg,
      source: 'manual',
    });
    console.log('[onboarding] completeOnboarding weight upsert ok');
  } catch (weightError) {
    console.log('[onboarding] completeOnboarding weight upsert failed', weightError);
    throw weightError;
  }

  try {
    console.log('[onboarding] completeOnboarding before calorie goal upsert', {
      userId,
      dailyCalorieGoal: data.dailyCalorieGoal,
      calorieGoalSource: data.calorieGoalSource,
    });
    await upsertDailyCalorieGoal({
      userId,
      dailyCalorieGoal: data.dailyCalorieGoal,
      source: data.calorieGoalSource,
    });
    console.log('[onboarding] completeOnboarding calorie goal upsert ok');
  } catch (calorieError) {
    console.log('[onboarding] completeOnboarding calorie goal upsert failed', calorieError);
    throw calorieError;
  }
}
