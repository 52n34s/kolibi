-- Adds custom to calorie_goal_source (app sends 'custom' for user-edited daily targets).
-- Existing DB values before this migration: calculated, manual

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'calorie_goal_source'
      AND pg_enum.enumlabel = 'custom'
  ) THEN
    ALTER TYPE public.calorie_goal_source ADD VALUE 'custom';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
