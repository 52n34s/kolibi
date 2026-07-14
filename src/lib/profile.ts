import type {
  ActivityLevel,
  BiologicalSex,
  CalorieGoalSource,
  GoalType,
} from '@/lib/onboarding';
import { upsertDailyCalorieGoal } from '@/lib/calorie-goals';
import { supabase } from '@/lib/supabase';

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

export async function fetchProfileSettings(userId: string): Promise<ProfileSettingsData> {
  const [profileResult, weightResult, calorieGoalResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, avatar_url, display_name, birth_date, biological_sex, height_cm, activity_level, goal_type, calorie_goal_source, trial_ends_at',
      )
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

  if (!profileResult.data) {
    throw new Error('Profile not found');
  }

  return {
    ...profileResult.data,
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

function getAvatarExtension(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    default:
      return 'jpg';
  }
}

export async function uploadAvatar(params: {
  userId: string;
  uri: string;
  mimeType?: string | null;
}) {
  const extension = getAvatarExtension(params.mimeType);
  const objectPath = `${params.userId}/avatar.${extension}`;

  const response = await fetch(params.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, blob, {
      upsert: true,
      contentType: params.mimeType ?? 'image/jpeg',
    });

  if (uploadError) {
    throw uploadError;
  }

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
  });
}

export async function updateCalorieGoal(params: {
  userId: string;
  goalType: GoalType;
  calorieGoalSource: CalorieGoalSource;
  dailyCalorieGoal: number;
  biologicalSex: BiologicalSex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}) {
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      goal_type: params.goalType,
      calorie_goal_source: params.calorieGoalSource,
    })
    .eq('id', params.userId);

  if (profileError) {
    throw profileError;
  }

  await upsertDailyCalorieGoal({
    userId: params.userId,
    dailyCalorieGoal: params.dailyCalorieGoal,
  });
}
