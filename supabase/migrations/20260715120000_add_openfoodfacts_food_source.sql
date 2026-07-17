-- Run manually in SQL Editor if food_source does not yet include 'openfoodfacts'.
-- Check first:
--   SELECT enumlabel FROM pg_enum e
--   JOIN pg_type t ON e.enumtypid = t.oid
--   WHERE t.typname = 'food_source';

ALTER TYPE public.food_source ADD VALUE IF NOT EXISTS 'openfoodfacts';
