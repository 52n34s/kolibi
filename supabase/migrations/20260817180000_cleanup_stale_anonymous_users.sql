-- Delete unused anonymous auth users older than 30 days.
-- Keep anyone who saved at least one meal (they may still convert).
-- Preview before the first run (SQL Editor, as postgres / service_role):
--
-- SELECT count(*) AS stale_anonymous_users
-- FROM auth.users u
-- WHERE COALESCE(u.is_anonymous, false) = true
--   AND u.created_at < now() - interval '30 days'
--   AND NOT EXISTS (SELECT 1 FROM public.meals m WHERE m.user_id = u.id)
--   AND NOT EXISTS (
--     SELECT 1 FROM auth.identities i
--     WHERE i.user_id = u.id
--       AND i.provider IS DISTINCT FROM 'anonymous'
--   );
--
-- Do not schedule this in the same change as the first delete.
-- Call once manually: SELECT public.cleanup_stale_anonymous_users();

CREATE OR REPLACE FUNCTION public.cleanup_stale_anonymous_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH stale AS (
    SELECT u.id
    FROM auth.users u
    WHERE COALESCE(u.is_anonymous, false) = true
      AND u.created_at < now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1
        FROM public.meals m
        WHERE m.user_id = u.id
      )
      -- Belt: never drop a user who already linked email/OAuth.
      AND NOT EXISTS (
        SELECT 1
        FROM auth.identities i
        WHERE i.user_id = u.id
          AND i.provider IS DISTINCT FROM 'anonymous'
      )
  )
  DELETE FROM auth.users u
  USING stale
  WHERE u.id = stale.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_anonymous_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_anonymous_users() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_anonymous_users() TO service_role;

NOTIFY pgrst, 'reload schema';
