-- Auto-create a public.profiles row when a new auth.users row is inserted.
--
-- Pre-flight checks (run manually in SQL Editor before applying, if desired):
--
-- 1) FK profiles.id -> auth.users.id
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_schema AS foreign_table_schema,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name = 'profiles'
--   AND kcu.column_name = 'id';
--
-- 2) Existing trigger with same name (should return 0 rows before migration)
-- SELECT trigger_name, event_object_schema, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
--
-- 3) Auth users missing a profile (backfill candidates; not applied here)
-- SELECT u.id, u.email, u.created_at
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL
-- ORDER BY u.created_at DESC;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
