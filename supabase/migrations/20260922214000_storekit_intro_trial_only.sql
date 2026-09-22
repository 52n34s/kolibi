-- StoreKit introductory offer is the sole trial path going forward.
-- Do not set profiles.trial_ends_at for new users. Column and has_premium_access()
-- stay unchanged so accounts still mid-DB-trial keep access until that date.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Anonymous → permanent conversion previously started a DB trial. That is a no-op now;
-- the App Store intro offer starts when the user subscribes.
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

  IF COALESCE(v_is_anonymous, true) AND NOT COALESCE(v_has_permanent_identity, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Intentionally does not write trial_ends_at.
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.start_trial_after_account_conversion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_trial_after_account_conversion() TO authenticated;

NOTIFY pgrst, 'reload schema';
