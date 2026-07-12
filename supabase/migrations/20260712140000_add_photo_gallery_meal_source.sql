-- =============================================================================
-- BLOCK 1 — RUN THIS FIRST (separate transaction from Block 2)
-- Adds photo_gallery to the live meal_source enum.
-- Postgres cannot add an enum value and reference it in the same transaction.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'meal_source'
      AND e.enumlabel = 'photo_gallery'
  ) THEN
    ALTER TYPE public.meal_source ADD VALUE 'photo_gallery';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
