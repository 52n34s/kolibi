import { supabase } from '@/lib/supabase';

import type { SupportedLanguage } from '@/i18n';

export type MealReminderBucket = 'breakfast' | 'lunch' | 'dinner';

export type MealReminderPreferences = {
  breakfastEnabled: boolean;
  lunchEnabled: boolean;
  dinnerEnabled: boolean;
  locale: SupportedLanguage;
};

type NotificationPreferencesRow = {
  meal_reminders_enabled?: boolean | null;
  breakfast_reminder_enabled: boolean | null;
  lunch_reminder_enabled: boolean | null;
  dinner_reminder_enabled: boolean | null;
  reminder_locale: string | null;
};

export const DEFAULT_MEAL_REMINDER_PREFERENCES: MealReminderPreferences = {
  breakfastEnabled: false,
  lunchEnabled: false,
  dinnerEnabled: false,
  locale: 'de',
};

function resolveLocale(value: string | null | undefined): SupportedLanguage {
  if (value === 'de' || value === 'en' || value === 'es') {
    return value;
  }
  return DEFAULT_MEAL_REMINDER_PREFERENCES.locale;
}

function mapRow(row: NotificationPreferencesRow | null): MealReminderPreferences {
  if (!row) {
    return { ...DEFAULT_MEAL_REMINDER_PREFERENCES };
  }

  return {
    breakfastEnabled: row.breakfast_reminder_enabled ?? false,
    lunchEnabled: row.lunch_reminder_enabled ?? false,
    dinnerEnabled: row.dinner_reminder_enabled ?? false,
    locale: resolveLocale(row.reminder_locale),
  };
}

export async function getMealReminderPreferences(
  userId: string,
): Promise<MealReminderPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'breakfast_reminder_enabled, lunch_reminder_enabled, dinner_reminder_enabled, reminder_locale',
    )
    .eq('user_id', userId)
    .maybeSingle<NotificationPreferencesRow>();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

export async function upsertMealReminderPreferences(
  userId: string,
  prefs: MealReminderPreferences,
): Promise<void> {
  const anyEnabled = prefs.breakfastEnabled || prefs.lunchEnabled || prefs.dinnerEnabled;

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: userId,
      meal_reminders_enabled: anyEnabled,
      breakfast_reminder_enabled: prefs.breakfastEnabled,
      lunch_reminder_enabled: prefs.lunchEnabled,
      dinner_reminder_enabled: prefs.dinnerEnabled,
      reminder_locale: prefs.locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}

/** @deprecated Prefer getMealReminderPreferences — kept for transitional call sites. */
export async function getMealRemindersEnabled(userId: string): Promise<boolean> {
  const prefs = await getMealReminderPreferences(userId);
  return prefs.breakfastEnabled || prefs.lunchEnabled || prefs.dinnerEnabled;
}

/** @deprecated Prefer upsertMealReminderPreferences. */
export async function setMealRemindersEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const current = await getMealReminderPreferences(userId);
  if (!enabled) {
    await upsertMealReminderPreferences(userId, {
      ...current,
      breakfastEnabled: false,
      lunchEnabled: false,
      dinnerEnabled: false,
    });
    return;
  }

  await upsertMealReminderPreferences(userId, {
    ...current,
    breakfastEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
  });
}
