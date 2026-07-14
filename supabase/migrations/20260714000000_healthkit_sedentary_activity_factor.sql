-- When health_connected is enabled, use sedentary activity factor (1.2) in calorie
-- goal calculation. Actual activity is added at runtime from HealthKit.

CREATE OR REPLACE FUNCTION public.activity_factor_for_user(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE(
      (
        SELECT up.is_enabled
        FROM public.user_preferences up
        WHERE up.user_id = p_user_id
          AND up.preference_key = 'health_connected'
        LIMIT 1
      ),
      false
    ) THEN 1.2::numeric
    ELSE CASE p.activity_level::text
      WHEN 'mostly_sitting' THEN 1.2
      WHEN 'lightly_active' THEN 1.375
      WHEN 'active' THEN 1.55
      WHEN 'very_active' THEN 1.725
      ELSE 1.2
    END
  END
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.compute_recommended_calorie_goal(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_weight_kg numeric;
  v_age integer;
  v_bmr numeric;
  v_activity_factor numeric;
  v_maintenance integer;
  v_percent_per_week numeric;
  v_uncapped_adjustment numeric;
  v_max_adjustment numeric;
  v_daily_adjustment numeric;
  v_raw_calories numeric;
  v_minimum integer;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.calorie_goal_source = 'custom' OR v_profile.goal_type = 'custom' THEN
    RETURN NULL;
  END IF;

  IF v_profile.birth_date IS NULL
    OR v_profile.activity_level IS NULL
    OR v_profile.goal_type IS NULL
    OR v_profile.height_cm IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT wl.weight_kg
  INTO v_weight_kg
  FROM public.weight_logs wl
  WHERE wl.user_id = p_user_id
  ORDER BY wl.logged_at DESC
  LIMIT 1;

  IF v_weight_kg IS NULL THEN
    RETURN NULL;
  END IF;

  v_age := date_part('year', age(current_date, v_profile.birth_date))::integer;

  IF v_profile.biological_sex = 'male' THEN
    v_bmr := 10 * v_weight_kg + 6.25 * v_profile.height_cm - 5 * v_age + 5;
    v_minimum := 1500;
  ELSIF v_profile.biological_sex = 'female' THEN
    v_bmr := 10 * v_weight_kg + 6.25 * v_profile.height_cm - 5 * v_age - 161;
    v_minimum := 1200;
  ELSE
    v_bmr := (
      (10 * v_weight_kg + 6.25 * v_profile.height_cm - 5 * v_age + 5)
      + (10 * v_weight_kg + 6.25 * v_profile.height_cm - 5 * v_age - 161)
    ) / 2;
    v_minimum := 1500;
  END IF;

  v_activity_factor := public.activity_factor_for_user(p_user_id);
  v_maintenance := round(v_bmr * v_activity_factor);

  v_percent_per_week := CASE v_profile.goal_type::text
    WHEN 'lose_weight' THEN 0.5
    WHEN 'faster_weight_loss' THEN 0.75
    WHEN 'gain_weight' THEN 0.375
    ELSE 0
  END;

  v_uncapped_adjustment := ((v_weight_kg * (v_percent_per_week / 100.0)) * 7700.0) / 7.0;
  v_max_adjustment := v_maintenance * 0.25;

  IF v_uncapped_adjustment > v_max_adjustment THEN
    v_daily_adjustment := v_max_adjustment;
  ELSE
    v_daily_adjustment := v_uncapped_adjustment;
  END IF;

  v_raw_calories := v_maintenance;

  IF v_profile.goal_type::text IN ('lose_weight', 'faster_weight_loss') THEN
    v_raw_calories := round(v_maintenance - v_daily_adjustment);
  ELSIF v_profile.goal_type::text = 'gain_weight' THEN
    v_raw_calories := round(v_maintenance + v_daily_adjustment);
  END IF;

  RETURN GREATEST(v_raw_calories::integer, v_minimum);
END;
$$;

NOTIFY pgrst, 'reload schema';
