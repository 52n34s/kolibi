import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import { localDateKey } from '@/lib/day-window';
import { suggestInitialTargetWeightKg } from '@/lib/macro-goals';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { upsertTodayWeightLog } from '@/lib/weight-logs';
import {
  calculateMaintenanceCalories,
  type ActivityLevel,
  type BiologicalSex,
  type CalorieGoalSource,
  type GoalType,
} from '@/lib/onboarding-calorie-goal';

export * from '@/lib/onboarding-calorie-goal';

export {
  applyOnboardingGoalTypeChange,
  resolveReviewCaloriePrefill,
  shouldRecalculateOnboardingDailyGoal,
  summaryManuallyEditedAfterGoalTypeChange,
  type ReviewCaloriePrefill,
  type ReviewCalorieProfileSeed,
} from '@/lib/onboarding-review-calorie';

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
