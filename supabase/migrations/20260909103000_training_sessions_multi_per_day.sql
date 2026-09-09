-- Allow multiple training_sessions per calendar day.
-- Weekly goal counts distinct logged_on days, not row count.

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_user_id_logged_on_key;

-- Some installs named the unique index differently:
DROP INDEX IF EXISTS public.training_sessions_user_id_logged_on_key;

CREATE INDEX IF NOT EXISTS training_sessions_user_logged_on_idx
  ON public.training_sessions (user_id, logged_on);

NOTIFY pgrst, 'reload schema';
