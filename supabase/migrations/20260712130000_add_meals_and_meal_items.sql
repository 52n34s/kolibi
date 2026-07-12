-- Meals logged via scan (and future sources). Items are normalized per ingredient.

CREATE TABLE IF NOT EXISTS public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  total_kcal numeric(10, 2) NOT NULL CHECK (total_kcal >= 0),
  source text NOT NULL DEFAULT 'scan',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES public.meals (id) ON DELETE CASCADE,
  name text NOT NULL,
  canonical_name text NOT NULL,
  quantity_grams numeric(10, 2),
  quantity_count numeric(10, 2),
  kcal numeric(10, 2) NOT NULL CHECK (kcal >= 0),
  confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_grams IS NOT NULL OR quantity_count IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS meals_user_id_logged_at_idx
  ON public.meals (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS meal_items_meal_id_idx
  ON public.meal_items (meal_id);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY meals_select_own
  ON public.meals
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY meals_insert_own
  ON public.meals
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY meals_update_own
  ON public.meals
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY meals_delete_own
  ON public.meals
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY meal_items_select_own
  ON public.meal_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meals
      WHERE meals.id = meal_items.meal_id
        AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY meal_items_insert_own
  ON public.meal_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meals
      WHERE meals.id = meal_items.meal_id
        AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY meal_items_update_own
  ON public.meal_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meals
      WHERE meals.id = meal_items.meal_id
        AND meals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meals
      WHERE meals.id = meal_items.meal_id
        AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY meal_items_delete_own
  ON public.meal_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meals
      WHERE meals.id = meal_items.meal_id
        AND meals.user_id = auth.uid()
    )
  );

-- Account deletion should remove meal data as well.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = current_user_id::text;

  DELETE FROM public.calorie_goals WHERE user_id = current_user_id;
  DELETE FROM public.meals WHERE user_id = current_user_id;
  DELETE FROM public.weight_logs WHERE user_id = current_user_id;
  DELETE FROM public.subscriptions WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
