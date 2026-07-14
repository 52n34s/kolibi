-- Trial period on signup + central premium access check (override, subscription, trial).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

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
    NOW() + INTERVAL '3 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT
        s.access_override = 'free_forever'
        OR (s.access_override = 'free_until' AND s.access_override_until > NOW())
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    OR COALESCE((
      SELECT s.is_active
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    OR COALESCE((
      SELECT p.trial_ends_at > NOW()
      FROM public.profiles p
      WHERE p.id = p_user_id
    ), false);
$$;

GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
