-- Manual strength-training sessions (HealthKit is unreliable for gym work).
-- Estimated kcal is display-only; not applied to the daily calorie goal.

CREATE TABLE IF NOT EXISTS public.gym_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  logged_on date NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 600),
  intensity text NOT NULL CHECK (intensity IN ('easy', 'normal', 'hard')),
  weight_kg numeric(5, 2) NOT NULL CHECK (weight_kg > 0),
  kcal integer NOT NULL CHECK (kcal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);

CREATE INDEX IF NOT EXISTS gym_sessions_user_logged_on_idx
  ON public.gym_sessions (user_id, logged_on DESC);

ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_sessions_select_own
  ON public.gym_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY gym_sessions_insert_own
  ON public.gym_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY gym_sessions_update_own
  ON public.gym_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY gym_sessions_delete_own
  ON public.gym_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_sessions TO service_role;

NOTIFY pgrst, 'reload schema';
