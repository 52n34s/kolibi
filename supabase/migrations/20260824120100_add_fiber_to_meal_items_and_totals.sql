-- Adds fiber_g to meal_items and total_fiber_g to meals, and extends
-- recompute_meal_totals to sum fiber with the same portion_factor scaling as
-- the other macros. meal_items.fiber_g is intentionally nullable with no
-- default (null = unknown, 0 = contains none), while meals.total_fiber_g is
-- not null default 0 — consistent with the three existing total_* columns.

alter table public.meal_items
  add column if not exists fiber_g numeric(10, 2) check (fiber_g is null or fiber_g >= 0);

alter table public.meals
  add column if not exists total_fiber_g numeric(10, 2) not null default 0;

create or replace function public.recompute_meal_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_meal_id uuid := coalesce(new.meal_id, old.meal_id);
begin
    update meals m set
        total_kcal      = coalesce((select sum(kcal      * coalesce(portion_factor, 1)) from meal_items where meal_id = v_meal_id), 0),
        total_protein_g = coalesce((select sum(protein_g * coalesce(portion_factor, 1)) from meal_items where meal_id = v_meal_id), 0),
        total_carbs_g   = coalesce((select sum(carbs_g   * coalesce(portion_factor, 1)) from meal_items where meal_id = v_meal_id), 0),
        total_fat_g     = coalesce((select sum(fat_g     * coalesce(portion_factor, 1)) from meal_items where meal_id = v_meal_id), 0),
        total_fiber_g   = coalesce((select sum(fiber_g   * coalesce(portion_factor, 1)) from meal_items where meal_id = v_meal_id), 0),
        updated_at      = now()
    where m.id = v_meal_id;
    return null;
end;
$$;

notify pgrst, 'reload schema';
