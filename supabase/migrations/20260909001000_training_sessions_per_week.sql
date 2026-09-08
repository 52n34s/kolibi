-- Weekly training frequency goal. null = no goal (Home row hidden).
-- Replaces gym_tracking_enabled / gym_sessions_per_week drafts.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS gym_tracking_enabled;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS gym_sessions_per_week;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_sessions_per_week smallint;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_training_sessions_per_week_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_training_sessions_per_week_check
  CHECK (
    training_sessions_per_week IS NULL
    OR (training_sessions_per_week BETWEEN 1 AND 14)
  );

NOTIFY pgrst, 'reload schema';
