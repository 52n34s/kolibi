import { supabase } from '@/lib/supabase';

export const HEALTH_CONNECTED_PREFERENCE_KEY = 'health_connected';

type UserPreferenceRow = {
  is_enabled: boolean;
};

export async function getUserPreference(userId: string, preferenceKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('is_enabled')
    .eq('user_id', userId)
    .eq('preference_key', preferenceKey)
    .maybeSingle<UserPreferenceRow>();

  if (error) {
    throw error;
  }

  return data?.is_enabled ?? false;
}

export async function setUserPreference(
  userId: string,
  preferenceKey: string,
  isEnabled: boolean,
): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      preference_key: preferenceKey,
      is_enabled: isEnabled,
    },
    { onConflict: 'user_id,preference_key' },
  );

  if (error) {
    throw error;
  }
}
