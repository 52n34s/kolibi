-- Ensures faster_weight_loss exists on profiles.goal_type enum.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'goal_type'
      AND pg_enum.enumlabel = 'faster_weight_loss'
  ) THEN
    ALTER TYPE goal_type ADD VALUE 'faster_weight_loss';
  END IF;
END $$;
