-- Allow count-based meal items without known piece weight (free manual entry).
-- quantity_grams = 0 means weight unknown; kcal holds the user-provided calories.
--
-- Run manually in SQL Editor if not applied via CLI.

ALTER TABLE public.meal_items DROP CONSTRAINT IF EXISTS meal_items_count_needs_fields;

ALTER TABLE public.meal_items DROP CONSTRAINT IF EXISTS meal_items_grams_per_unit_positive;

ALTER TABLE public.meal_items
  ADD CONSTRAINT meal_items_count_needs_count
  CHECK (quantity_type <> 'count' OR count IS NOT NULL);

ALTER TABLE public.meal_items
  ADD CONSTRAINT meal_items_grams_per_unit_positive
  CHECK (grams_per_unit IS NULL OR grams_per_unit > 0);

NOTIFY pgrst, 'reload schema';
