-- IANA device timezone for meal-time stats and push reminders.
-- Apply manually in Supabase SQL Editor if preferred.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Berlin';

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA timezone from device (e.g. America/New_York). Used for meal-time stats and push reminders.';

NOTIFY pgrst, 'reload schema';
