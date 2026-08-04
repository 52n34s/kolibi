-- user_meal_time_stats: personalized meal-time averages for push reminders (v1).
-- Run manually in Supabase SQL Editor. Do not apply via MCP/CLI from the agent.

CREATE TABLE IF NOT EXISTS public.user_meal_time_stats (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  breakfast_avg_time time,
  lunch_avg_time time,
  dinner_avg_time time,
  breakfast_sample_count int NOT NULL DEFAULT 0,
  lunch_sample_count int NOT NULL DEFAULT 0,
  dinner_sample_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_meal_time_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_meal_time_stats_select_own
  ON public.user_meal_time_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated:
-- writes only via Edge Function with service role.

NOTIFY pgrst, 'reload schema';
