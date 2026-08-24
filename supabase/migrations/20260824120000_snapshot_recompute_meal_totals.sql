-- Snapshot: public.recompute_meal_totals as it existed live before the fiber
-- extension. The function was already present in production but had never been
-- captured in a versioned migration; this file records that pre-fiber state.

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
        updated_at      = now()
    where m.id = v_meal_id;
    return null;
end;
$$;
