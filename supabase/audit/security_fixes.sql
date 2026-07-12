-- =============================================================================
-- Kolibi security fixes — run manually in Supabase SQL Editor
-- =============================================================================
-- Prerequisite: review output of supabase/audit/security_audit.sql first.
-- This script is idempotent where possible (DROP IF EXISTS / CREATE OR REPLACE).
-- Order matters: functions → grants → policies → views → indexes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) check_scan_rate_limit — atomic counter + locked-down EXECUTE grants
-- Live columns (verified via PostgREST): user_id, window_start, request_count
-- Replaces any SELECT-then-UPDATE implementation that races under parallel scans.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_counters_user_id_window_start_key
  ON public.rate_limit_counters (user_id, window_start);

CREATE OR REPLACE FUNCTION public.check_scan_rate_limit(
  p_user_id uuid,
  p_max_requests integer,
  p_window interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start timestamptz;
  v_request_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_max_requests IS NULL OR p_max_requests < 1 THEN
    RAISE EXCEPTION 'p_max_requests must be >= 1';
  END IF;

  -- Daily UTC window (matches edge-function resetAt midnight UTC logic).
  v_window_start := date_trunc('day', timezone('utc', now()));

  INSERT INTO public.rate_limit_counters AS rl (user_id, window_start, request_count)
  VALUES (p_user_id, v_window_start, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE
    SET request_count = rl.request_count + 1
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_scan_rate_limit(uuid, integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_scan_rate_limit(uuid, integer, interval) FROM anon;
REVOKE ALL ON FUNCTION public.check_scan_rate_limit(uuid, integer, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_scan_rate_limit(uuid, integer, interval) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) is_admin() — must resolve auth.uid() internally; no user-supplied id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- -----------------------------------------------------------------------------
-- 3) SECURITY DEFINER helpers — harden search_path (search-path hijack defense)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = current_user_id::text;

  DELETE FROM public.calorie_goals WHERE user_id = current_user_id;
  DELETE FROM public.meals WHERE user_id = current_user_id;
  DELETE FROM public.weight_logs WHERE user_id = current_user_id;
  DELETE FROM public.subscriptions WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) subscriptions — block client-side access_override privilege escalation
-- access_override* lives on subscriptions (not profiles). Users must not flip it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_subscription_override_client_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    NEW.access_override IS DISTINCT FROM OLD.access_override
    OR NEW.access_override_until IS DISTINCT FROM OLD.access_override_until
    OR NEW.access_override_note IS DISTINCT FROM OLD.access_override_note
  ) THEN
    -- service_role / postgres bypass RLS triggers as table owner; authenticated cannot.
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Cannot modify subscription access_override fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subscription_override_client_write ON public.subscriptions;
CREATE TRIGGER trg_prevent_subscription_override_client_write
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_subscription_override_client_write();

-- Belt-and-suspenders: authenticated should only read subscriptions, not write.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) rate_limit_counters — must be service-role only (no client access)
-- API probe: anon DELETE returned 204 → DELETE grant/policy must be removed.
-- -----------------------------------------------------------------------------
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_counters_select_own ON public.rate_limit_counters;
DROP POLICY IF EXISTS rate_limit_counters_insert_own ON public.rate_limit_counters;
DROP POLICY IF EXISTS rate_limit_counters_update_own ON public.rate_limit_counters;
DROP POLICY IF EXISTS rate_limit_counters_delete_own ON public.rate_limit_counters;

REVOKE ALL ON TABLE public.rate_limit_counters FROM anon;
REVOKE ALL ON TABLE public.rate_limit_counters FROM authenticated;

-- -----------------------------------------------------------------------------
-- 6) scan_logs — users SELECT own rows only; writes are service-role only
-- raw_response (jsonb) is row-scoped like all other columns; no separate policy needed.
-- Edge function writes food-only model output (items: name, grams, kcal, etc.) — never images/prompts.
-- -----------------------------------------------------------------------------
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_logs_select_own ON public.scan_logs;
DROP POLICY IF EXISTS scan_logs_insert_own ON public.scan_logs;
DROP POLICY IF EXISTS scan_logs_update_own ON public.scan_logs;
DROP POLICY IF EXISTS scan_logs_delete_own ON public.scan_logs;

CREATE POLICY scan_logs_select_own
  ON public.scan_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.scan_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.scan_logs FROM authenticated;
GRANT SELECT ON TABLE public.scan_logs TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) admin_users — no self-insert; admin list not readable by regular users
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_select_self ON public.admin_users;
DROP POLICY IF EXISTS admin_users_insert_self ON public.admin_users;
DROP POLICY IF EXISTS admin_users_all ON public.admin_users;

-- No policies for authenticated/anon → default deny under RLS.

REVOKE ALL ON TABLE public.admin_users FROM anon;
REVOKE ALL ON TABLE public.admin_users FROM authenticated;

-- -----------------------------------------------------------------------------
-- 8) feature_flags / ai_cache — internal only (edge functions / admin tooling)
-- -----------------------------------------------------------------------------
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_write ON public.feature_flags;

REVOKE ALL ON TABLE public.feature_flags FROM anon;
REVOKE ALL ON TABLE public.feature_flags FROM authenticated;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_cache_select ON public.ai_cache;
DROP POLICY IF EXISTS ai_cache_write ON public.ai_cache;

REVOKE ALL ON TABLE public.ai_cache FROM anon;
REVOKE ALL ON TABLE public.ai_cache FROM authenticated;

-- Seed kill-switch row if missing (edge function can read via service_role).
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('ai_scan_enabled', true, 'Master kill switch for meal-vision AI scans')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9) meal_items — CRITICAL: enforce BOTH user_id AND meal ownership
-- Live schema has meal_items.user_id (verified). Policy must not allow inserting
-- into another user's meal via a known meal_id UUID.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS meal_items_insert_own ON public.meal_items;
DROP POLICY IF EXISTS meal_items_update_own ON public.meal_items;

CREATE POLICY meal_items_insert_own
  ON public.meal_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.meals m
      WHERE m.id = meal_items.meal_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY meal_items_update_own
  ON public.meal_items
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.meals m
      WHERE m.id = meal_items.meal_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.meals m
      WHERE m.id = meal_items.meal_id
        AND m.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 10) Observability views — must run as invoker, not definer (cross-user leak)
-- -----------------------------------------------------------------------------
ALTER VIEW IF EXISTS public.v_scan_stats_daily SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_scan_stats_by_user SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_daily_active_users SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_revenue_overview SET (security_invoker = true);

-- If views are missing security_invoker support, recreate manually after inspecting
-- pg_get_viewdef(). These tables should also lose direct authenticated SELECT:
REVOKE SELECT ON TABLE public.v_scan_stats_by_user FROM anon;
REVOKE SELECT ON TABLE public.v_scan_stats_by_user FROM authenticated;
REVOKE SELECT ON TABLE public.v_daily_active_users FROM anon;
REVOKE SELECT ON TABLE public.v_daily_active_users FROM authenticated;
REVOKE SELECT ON TABLE public.v_revenue_overview FROM anon;
REVOKE SELECT ON TABLE public.v_revenue_overview FROM authenticated;

-- v_scan_stats_daily is aggregate-only (no per-user rows) — may stay readable if desired.
-- To lock it down as well, uncomment:
-- REVOKE SELECT ON TABLE public.v_scan_stats_daily FROM anon;
-- REVOKE SELECT ON TABLE public.v_scan_stats_daily FROM authenticated;

-- -----------------------------------------------------------------------------
-- 11) Index for hot queries — live uses eaten_at, repo migration had logged_at
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS meals_user_id_eaten_at_idx
  ON public.meals (user_id, eaten_at DESC);

CREATE INDEX IF NOT EXISTS scan_logs_user_id_created_at_idx
  ON public.scan_logs (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 12) Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
