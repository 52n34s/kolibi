-- Per-meal reminder toggles (defaults all off). Timing stays learned from
-- user_meal_time_stats in send-meal-reminders — no user-facing clock times.
-- meal_reminders_enabled remains for backwards compatibility.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS breakfast_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lunch_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dinner_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_locale text NOT NULL DEFAULT 'de';

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_reminder_locale_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_reminder_locale_check
  CHECK (reminder_locale IN ('de', 'en', 'es'));

NOTIFY pgrst, 'reload schema';
