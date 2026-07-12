-- Manual premium overrides for family/friends (admin-managed in Supabase Table Editor).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_override_type') THEN
    CREATE TYPE public.access_override_type AS ENUM ('none', 'free_forever', 'free_until');
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS access_override public.access_override_type NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS access_override_until timestamptz,
  ADD COLUMN IF NOT EXISTS access_override_note text;

NOTIFY pgrst, 'reload schema';
