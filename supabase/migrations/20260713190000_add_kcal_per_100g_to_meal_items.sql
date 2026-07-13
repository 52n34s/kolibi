-- Reference kcal density for linked quantity/kcal editing (OFF, foods match, etc.)

ALTER TABLE public.meal_items
  ADD COLUMN IF NOT EXISTS kcal_per_100g numeric(7, 2);

NOTIFY pgrst, 'reload schema';
