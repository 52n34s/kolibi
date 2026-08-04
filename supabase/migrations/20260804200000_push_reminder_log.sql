-- push_reminder_log: dedupe meal push reminders per user/bucket/local day.
-- Apply manually in Supabase SQL Editor. Do not apply via MCP/CLI from the agent.

CREATE TABLE IF NOT EXISTS public.push_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  meal_bucket text NOT NULL CHECK (meal_bucket IN ('breakfast', 'lunch', 'dinner')),
  sent_on date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, meal_bucket, sent_on)
);

ALTER TABLE public.push_reminder_log ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: clients have no access.
-- Service role bypasses RLS; grant kept explicit for clarity.

GRANT SELECT, INSERT ON public.push_reminder_log TO service_role;

NOTIFY pgrst, 'reload schema';
