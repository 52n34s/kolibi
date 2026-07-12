-- =============================================================================
-- BLOCK 2 — RUN AFTER Block 1 has committed
-- Adds include_in_calibration to user_food_adjustments and updates the trigger
-- function so gallery (and future non-calibration) corrections are stored but
-- do not update user_food_calibration.
--
-- NOTE: The app inserts user_food_adjustments on meal save (edited AI items).
-- If you also have a trigger on meal_items that inserts adjustments, disable or
-- update it to avoid duplicate rows and to respect include_in_calibration.
-- =============================================================================

ALTER TABLE public.user_food_adjustments
  ADD COLUMN IF NOT EXISTS include_in_calibration boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.apply_food_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.include_in_calibration = false THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_food_calibration (
    user_id,
    food_name_normalized,
    food_id,
    sample_count,
    avg_ratio,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.food_name_normalized,
    NEW.food_id,
    1,
    COALESCE(NEW.adjustment_ratio, 1),
    NOW()
  )
  ON CONFLICT (user_id, food_name_normalized) DO UPDATE SET
    avg_ratio = (
      user_food_calibration.avg_ratio * user_food_calibration.sample_count
      + COALESCE(NEW.adjustment_ratio, 1)
    ) / (user_food_calibration.sample_count + 1),
    sample_count = user_food_calibration.sample_count + 1,
    food_id = COALESCE(EXCLUDED.food_id, user_food_calibration.food_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
