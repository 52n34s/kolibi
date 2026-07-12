-- Rename profiles.sex -> biological_sex (align DB with app data model).
--
-- Pre-flight checks (optional; run separately before applying):
--
-- 1) Views referencing profiles.sex
-- SELECT viewname, definition
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND (definition ILIKE '%profiles.sex%' OR definition ~* '\msex\M');
--
-- 2) RLS policies on profiles mentioning sex
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS with_check_expr
-- FROM pg_policy
-- JOIN pg_class ON pg_class.oid = pg_policy.polrelid
-- JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
-- WHERE nspname = 'public' AND relname = 'profiles'
--   AND (
--     pg_get_expr(polqual, polrelid) ILIKE '%sex%'
--     OR pg_get_expr(polwithcheck, polrelid) ILIKE '%sex%'
--   );
--
-- 3) Trigger functions that mention profiles.sex / NEW.sex
-- SELECT p.proname, pg_get_functiondef(p.oid) AS definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND pg_get_functiondef(p.oid) ILIKE '%sex%';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'sex'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'biological_sex'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN sex TO biological_sex;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
