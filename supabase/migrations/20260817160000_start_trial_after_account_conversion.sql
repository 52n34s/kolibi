-- Start the 3-day trial after an anonymous user is converted to a permanent account.
-- handle_new_user does not fire again (same auth.users row), so trial_ends_at stays NULL
-- unless we set it here. Clients must not write trial_ends_at themselves.

CREATE OR REPLACE FUNCTION public.start_trial_after_account_conversion()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_anonymous boolean;
  v_has_permanent_identity boolean;
  v_trial_ends_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.is_anonymous
  INTO v_is_anonymous
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = v_uid
      AND i.provider IS DISTINCT FROM 'anonymous'
  )
  INTO v_has_permanent_identity;

  -- Block anonymous sessions that have not linked email/OAuth yet.
  -- After updateUser/linkIdentity an email or oauth identity exists even if
  -- the JWT still has is_anonymous=true pending confirmation.
  IF COALESCE(v_is_anonymous, true) AND NOT COALESCE(v_has_permanent_identity, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET trial_ends_at = now() + interval '3 days'
  WHERE id = v_uid
    AND trial_ends_at IS NULL
  RETURNING trial_ends_at INTO v_trial_ends_at;

  RETURN v_trial_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_trial_after_account_conversion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_trial_after_account_conversion() TO authenticated;

NOTIFY pgrst, 'reload schema';
