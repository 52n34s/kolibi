-- Emergency rollback for 20260817150000_anonymous_trial_skip_and_premium_rpc_guard.
-- Restore live function bodies from before that migration.
-- Do not place this file in supabase/migrations/; do not apply via db push.

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

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

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
        CASE s.access_override
          WHEN 'free_forever' THEN true
          WHEN 'free_until' THEN s.access_override_until IS NOT NULL
            AND s.access_override_until > NOW()
          ELSE false
        END
      FROM subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    OR COALESCE((
      SELECT s.is_active
      FROM subscriptions s
      WHERE s.user_id = p_user_id
    ), false)
    OR COALESCE((
      SELECT p.trial_ends_at > NOW()
      FROM profiles p
      WHERE p.id = p_user_id
    ), false);
$$;

GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
