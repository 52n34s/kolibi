import { supabase } from '@/lib/supabase';

type NotificationPreferencesRow = {
  meal_reminders_enabled: boolean;
};

/** Default true when no row exists (opt-out model). */
export async function getMealRemindersEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('meal_reminders_enabled')
    .eq('user_id', userId)
    .maybeSingle<NotificationPreferencesRow>();

  if (error) {
    throw error;
  }

  return data?.meal_reminders_enabled ?? true;
}

export async function setMealRemindersEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: userId,
      meal_reminders_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}
