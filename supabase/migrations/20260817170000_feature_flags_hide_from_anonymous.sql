-- feature_flags is an internal kill-switch table (ai_scan_enabled), not UI toggles.
-- Live policy feature_flags_select_all used USING (true) for all authenticated JWTs,
-- including anonymous sessions. Restrict SELECT to permanent users.

DROP POLICY IF EXISTS feature_flags_select_all ON public.feature_flags;

CREATE POLICY feature_flags_select_all
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');
