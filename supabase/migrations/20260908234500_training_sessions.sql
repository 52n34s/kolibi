-- Manual training sessions (HealthKit is unreliable for many workout types).
-- estimated_kcal is the effective value (MET estimate or manual override); kcal_source records which.

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  logged_on date NOT NULL,
  training_type text NOT NULL DEFAULT 'strength'
    CHECK (training_type IN ('strength', 'yoga', 'swimming', 'cycling', 'other')),
  duration_min integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 600),
  intensity text NOT NULL CHECK (intensity IN ('easy', 'normal', 'hard')),
  estimated_kcal integer NOT NULL CHECK (estimated_kcal >= 0),
  kcal_source text NOT NULL DEFAULT 'estimated' CHECK (kcal_source IN ('estimated', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_sessions_user_logged_on_idx
  ON public.training_sessions (user_id, logged_on);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_sessions_select_own
  ON public.training_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY training_sessions_insert_own
  ON public.training_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY training_sessions_update_own
  ON public.training_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY training_sessions_delete_own
  ON public.training_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO service_role;

-- Drop earlier gym_* draft table if it was applied.
DROP TABLE IF EXISTS public.gym_sessions;

NOTIFY pgrst, 'reload schema';
