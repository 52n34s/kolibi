-- Daily HealthKit active-energy snapshots for history (client-written).

CREATE TABLE IF NOT EXISTS public.daily_health_stats (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day date NOT NULL,
  active_energy_kcal numeric(6, 1),
  health_connected boolean NOT NULL DEFAULT false,
  backfilled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS daily_health_stats_user_id_day_idx
  ON public.daily_health_stats (user_id, day DESC);

ALTER TABLE public.daily_health_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_health_stats_select_own
  ON public.daily_health_stats
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY daily_health_stats_insert_own
  ON public.daily_health_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY daily_health_stats_update_own
  ON public.daily_health_stats
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY daily_health_stats_delete_own
  ON public.daily_health_stats
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
