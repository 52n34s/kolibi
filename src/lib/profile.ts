import type {
  ActivityLevel,
  BiologicalSex,
  CalorieGoalSource,
  GoalType,
} from '@/lib/onboarding';
import {
  refreshMacrosKeepingCalorieGoal,
  upsertDailyCalorieGoal,
} from '@/lib/calorie-goals';
import { uploadImageToStorage } from '@/lib/storage-upload';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

export type MovementGoalType = 'steps' | 'running_km' | 'distance_km';
export type MovementGoalPeriod = 'day' | 'week';

const PROFILE_SETTINGS_SELECT =
  'id, avatar_url, display_name, birth_date, biological_sex, height_cm, activity_level, goal_type, calorie_goal_source, trial_ends_at, diet_preference, cuisine_context, movement_goal_type, movement_goal_value, movement_goal_period, target_weight_kg, progress_start_date, training_sessions_per_week';

export type ProfileSettingsData = {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
  birth_date: string | null;
  biological_sex: BiologicalSex | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  goal_type: GoalType | null;
  calorie_goal_source: CalorieGoalSource | null;
  trial_ends_at: string | null;
  diet_preference: string | null;
  cuisine_context: string[] | null;
  movement_goal_type: MovementGoalType | null;
  movement_goal_value: number | null;
  movement_goal_period: MovementGoalPeriod | null;
  target_weight_kg: number | null;
  progress_start_date: string | null;
  training_sessions_per_week: number | null;
  latest_weight_kg: number | null;
  daily_calorie_goal: number | null;
};

export type AccessOverrideType = 'none' | 'free_forever' | 'free_until';

export type SubscriptionRow = {
  user_id: string;
  status: string | null;
  is_active: boolean | null;
  product_id: string | null;
  store: string | null;
  environment: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  updated_at: string | null;
  access_override: AccessOverrideType | null;
  access_override_until: string | null;
  access_override_note: string | null;
};

export type PremiumAccessResult = {
  hasAccess: boolean;
  source: 'override' | 'subscription' | 'none';
};

const AVATAR_BUCKET = 'avatars';

export async function fetchProfileSettings(
  userId: string,
  alreadyRecovered = false,
): Promise<ProfileSettingsData> {
  const [profileResult, weightResult, calorieGoalResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(PROFILE_SETTINGS_SELECT)
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('calorie_goals')
      .select('daily_calorie_goal')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (weightResult.error) {
    throw weightResult.error;
  }

  if (calorieGoalResult.error) {
    throw calorieGoalResult.error;
  }

  let profile = profileResult.data;

  if (!profile && !alreadyRecovered) {
    const outcome = await useAuthStore.getState().recoverSessionIfUserMissing();

    if (outcome === 'recovered') {
      const nextId = useAuthStore.getState().session?.user?.id;
      if (nextId && nextId !== userId) {
        return fetchProfileSettings(nextId, true);
      }
    }

    if (outcome === 'user_exists') {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const retry = await supabase
        .from('profiles')
        .select(PROFILE_SETTINGS_SELECT)
        .eq('id', userId)
        .maybeSingle();

      if (retry.error) {
        throw retry.error;
      }

      profile = retry.data;
    }
  }

  if (!profile) {
    throw new Error('Profile not found');
  }

  const movementGoalType = parseMovementGoalType(profile.movement_goal_type);
  const movementGoalPeriod = parseMovementGoalPeriod(profile.movement_goal_period);
  const rawMovementValue =
    profile.movement_goal_value == null ? null : Number(profile.movement_goal_value);

  return {
    ...profile,
    diet_preference: profile.diet_preference ?? null,
    cuisine_context: Array.isArray(profile.cuisine_context)
      ? profile.cuisine_context
      : null,
    movement_goal_type: movementGoalType,
    movement_goal_value:
      rawMovementValue != null && Number.isFinite(rawMovementValue) ? rawMovementValue : null,
    movement_goal_period: movementGoalPeriod,
    target_weight_kg: (() => {
      if (profile.target_weight_kg == null) {
        return null;
      }
      const parsed = Number(profile.target_weight_kg);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    progress_start_date:
      typeof profile.progress_start_date === 'string' ? profile.progress_start_date : null,
    training_sessions_per_week: (() => {
      if (profile.training_sessions_per_week == null) {
        return null;
      }
      const parsed = Number(profile.training_sessions_per_week);
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 14 ? parsed : null;
    })(),
    latest_weight_kg: weightResult.data?.weight_kg ?? null,
    daily_calorie_goal: calorieGoalResult.data?.daily_calorie_goal ?? null,
  };
}

export async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'user_id, status, is_active, product_id, store, environment, current_period_start, current_period_end, updated_at, access_override, access_override_until, access_override_note',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function resolvePremiumAccess(subscription: SubscriptionRow | null): PremiumAccessResult {
  if (!subscription) {
    return { hasAccess: false, source: 'none' };
  }

  if (subscription.access_override === 'free_forever') {
    return { hasAccess: true, source: 'override' };
  }

  if (
    subscription.access_override === 'free_until' &&
    subscription.access_override_until &&
    new Date(subscription.access_override_until) > new Date()
  ) {
    return { hasAccess: true, source: 'override' };
  }

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const subscriptionActive =
    !!subscription.is_active &&
    (!periodEnd || periodEnd > new Date()) &&
    subscription.status !== 'expired' &&
    subscription.status !== 'cancelled';

  if (subscriptionActive) {
    return { hasAccess: true, source: 'subscription' };
  }

  return { hasAccess: false, source: 'none' };
}

export async function updateDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error('Name is required');
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { full_name: trimmed },
  });

  if (metadataError) {
    throw metadataError;
  }

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId);

  if (profileError) {
    throw profileError;
  }
}

export async function updateFoodContext(params: {
  dietPreference: string | null;
  cuisineContext: string[];
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      diet_preference: params.dietPreference,
      cuisine_context: params.cuisineContext,
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }

  await refreshMacrosKeepingCalorieGoal(userId);
}

function parseMovementGoalType(value: unknown): MovementGoalType | null {
  if (value === 'steps' || value === 'running_km' || value === 'distance_km') {
    return value;
  }
  return null;
}

function parseMovementGoalPeriod(value: unknown): MovementGoalPeriod | null {
  if (value === 'day' || value === 'week') {
    return value;
  }
  return null;
}

/** Writes all three movement-goal columns together. Does not touch calorie_goals. */
export async function updateMovementGoal(params: {
  userId: string;
  movementGoalType: MovementGoalType | null;
  movementGoalValue: number | null;
  movementGoalPeriod: MovementGoalPeriod | null;
}): Promise<void> {
  if (params.movementGoalType == null) {
    const { error } = await supabase
      .from('profiles')
      .update({
        movement_goal_type: null,
        movement_goal_value: null,
        movement_goal_period: null,
      })
      .eq('id', params.userId);

    if (error) {
      throw error;
    }
    return;
  }

  if (
    params.movementGoalValue == null ||
    !(params.movementGoalValue > 0) ||
    params.movementGoalPeriod == null
  ) {
    throw new Error('invalid_movement_goal');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      movement_goal_type: params.movementGoalType,
      movement_goal_value: params.movementGoalValue,
      movement_goal_period: params.movementGoalPeriod,
    })
    .eq('id', params.userId);

  if (error) {
    throw error;
  }
}

/** Weekly training goal. null clears the goal (Home row hidden). Does not delete training_sessions. */
export async function updateTrainingSessionsPerWeek(params: {
  userId: string;
  sessionsPerWeek: number | null;
}): Promise<void> {
  if (params.sessionsPerWeek != null) {
    const value = Math.round(params.sessionsPerWeek);
    if (!(value >= 1 && value <= 14)) {
      throw new Error('invalid_training_sessions_per_week');
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ training_sessions_per_week: params.sessionsPerWeek })
    .eq('id', params.userId);

  if (error) {
    throw error;
  }
}

export async function fetchDietPreference(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('diet_preference')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.diet_preference ?? null;
}

const AVATAR_MAX_EDGE_PX = 512;
const AVATAR_QUALITY = 0.85;

export async function uploadAvatar(params: { userId: string; uri: string }) {
  // Always re-encoded to JPEG: the picker also hands back HEIC, and one fixed
  // extension keeps the object path stable across re-uploads (upsert).
  const { objectPath } = await uploadImageToStorage({
    bucket: AVATAR_BUCKET,
    objectPath: `${params.userId}/avatar.jpg`,
    localUri: params.uri,
    format: 'jpeg',
    maxEdgePx: AVATAR_MAX_EDGE_PX,
    quality: AVATAR_QUALITY,
  });

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: objectPath })
    .eq('id', params.userId);

  if (profileError) {
    throw profileError;
  }

  return objectPath;
}

export async function getAvatarSignedUrl(
  avatarPath: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!avatarPath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function changePassword(params: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.currentPassword,
  });

  if (verifyError) {
    throw verifyError;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: params.newPassword,
  });

  if (updateError) {
    throw updateError;
  }
}

export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    throw error;
  }
}

export async function updateDailyCalorieGoal(params: {
  userId: string;
  dailyCalorieGoal: number;
  tdee?: number | null;
}) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      calorie_goal_source: 'custom',
    })
    .eq('id', params.userId);

  if (profileError) {
    throw profileError;
  }

  await upsertDailyCalorieGoal({
    userId: params.userId,
    dailyCalorieGoal: params.dailyCalorieGoal,
    source: 'custom',
    tdee: params.tdee,
  });
}
