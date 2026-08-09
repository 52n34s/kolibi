-- Lightweight user activity tracking for admin analytics.
-- Run manually in Supabase SQL Editor. Do not apply via MCP/CLI from the agent.

-- ---------------------------------------------------------------------------
-- 1) profiles.last_active_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_active_at_idx
  ON public.profiles (last_active_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 2) touch_user_activity — client heartbeat (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_user_activity(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET last_active_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_user_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_user_activity(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) v_user_activity_summary — per-user engagement snapshot (admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_user_activity_summary
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  p.last_active_at,
  COALESCE(meal_stats.meals_last_7d, 0)::bigint AS meals_last_7d,
  COALESCE(meal_stats.meals_last_30d, 0)::bigint AS meals_last_30d,
  COALESCE(scan_stats.scans_last_7d, 0)::bigint AS scans_last_7d,
  COALESCE(scan_stats.scans_last_30d, 0)::bigint AS scans_last_30d,
  COALESCE(meal_stats.manual_entries_last_7d, 0)::bigint AS manual_entries_last_7d,
  COALESCE(weight_stats.weight_logs_last_7d, 0)::bigint AS weight_logs_last_7d,
  COALESCE(weight_stats.weight_logs_last_30d, 0)::bigint AS weight_logs_last_30d
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT m.id) FILTER (
      WHERE m.created_at >= now() - interval '7 days'
    ) AS meals_last_7d,
    COUNT(DISTINCT m.id) FILTER (
      WHERE m.created_at >= now() - interval '30 days'
    ) AS meals_last_30d,
    COUNT(DISTINCT m.id) FILTER (
      WHERE m.created_at >= now() - interval '7 days'
        AND m.source = 'manual'
    ) AS manual_entries_last_7d
  FROM public.meals m
  INNER JOIN public.meal_items mi ON mi.meal_id = m.id
  WHERE m.user_id = p.id
) meal_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (
      WHERE sl.created_at >= now() - interval '7 days'
    )::bigint AS scans_last_7d,
    COUNT(*) FILTER (
      WHERE sl.created_at >= now() - interval '30 days'
    )::bigint AS scans_last_30d
  FROM public.scan_logs sl
  WHERE sl.user_id = p.id
    AND sl.created_at >= now() - interval '30 days'
) scan_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (
      WHERE wl.logged_at >= now() - interval '7 days'
    )::bigint AS weight_logs_last_7d,
    COUNT(*) FILTER (
      WHERE wl.logged_at >= now() - interval '30 days'
    )::bigint AS weight_logs_last_30d
  FROM public.weight_logs wl
  WHERE wl.user_id = p.id
    AND wl.logged_at >= now() - interval '30 days'
) weight_stats ON true;

-- ---------------------------------------------------------------------------
-- 4) v_daily_active_users_v2 — distinct active users per Europe/Berlin day
--    Active = meal saved OR weight log created OR last_active_at on that day.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_daily_active_users_v2
WITH (security_invoker = true)
AS
SELECT
  activity_day AS day,
  COUNT(DISTINCT user_id)::bigint AS active_users
FROM (
  SELECT
    m.user_id,
    (m.created_at AT TIME ZONE 'Europe/Berlin')::date AS activity_day
  FROM public.meals m

  UNION

  SELECT
    wl.user_id,
    (wl.logged_at AT TIME ZONE 'Europe/Berlin')::date AS activity_day
  FROM public.weight_logs wl

  UNION

  SELECT
    p.id AS user_id,
    (p.last_active_at AT TIME ZONE 'Europe/Berlin')::date AS activity_day
  FROM public.profiles p
  WHERE p.last_active_at IS NOT NULL
) activity
GROUP BY activity_day;

REVOKE ALL ON public.v_user_activity_summary, public.v_daily_active_users_v2
  FROM PUBLIC, anon;
GRANT SELECT ON public.v_user_activity_summary, public.v_daily_active_users_v2
  TO authenticated;

NOTIFY pgrst, 'reload schema';
