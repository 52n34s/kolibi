-- Adds gain_weight to the profiles.goal_type enum (moderate weight gain target).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'goal_type'
      AND pg_enum.enumlabel = 'gain_weight'
  ) THEN
    ALTER TYPE goal_type ADD VALUE 'gain_weight';
  END IF;
END $$;
