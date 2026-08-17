-- Skip 3-day trial for anonymous users; lock has_premium_access to own uid.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE
      WHEN COALESCE(NEW.is_anonymous, false)
        OR COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'anonymous'
      THEN NULL
      ELSE NOW() + INTERVAL '3 days'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN
    -- 1. Manuelle Freischaltung
    COALESCE((
      SELECT
        CASE s.access_override
          WHEN 'free_forever' THEN true
          WHEN 'free_until' THEN s.access_override_until IS NOT NULL
            AND s.access_override_until > NOW()
          ELSE false
        END
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    -- 2. Aktives Abo
    OR COALESCE((
      SELECT s.is_active
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    -- 3. Trial läuft noch
    OR COALESCE((
      SELECT p.trial_ends_at > NOW()
      FROM public.profiles p
      WHERE p.id = p_user_id
    ), false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
