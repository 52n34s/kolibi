-- =========================================================
-- 0016_top_foods_recent.sql
-- top_foods: zuletzt = Verzehrzeit (meals.eaten_at), Sortierung
-- nach Zeitpunkt zuerst — damit der Reiter "Zuletzt" stimmt.
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
-- Nicht erneut ausführen.
-- =========================================================

-- meal_items.meal_id → meals.id; Verzehrzeit auf meals heißt eaten_at
-- (nicht logged_at — das war der alte Migrationsname).

create or replace function public.top_foods(p_limit integer default 30)
returns table(
  label text,
  food_id uuid,
  n bigint,
  zuletzt timestamptz,
  kcal_per_100g numeric,
  protein_per_100g numeric,
  fat_per_100g numeric,
  carbs_per_100g numeric,
  fiber_per_100g numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with grouped as (
    select
      kolibi_fold(coalesce(f.names->>'de', mi.name)) as fold_key,
      max(coalesce(f.names->>'de', mi.name)) as label,
      (array_agg(mi.food_id) filter (where mi.food_id is not null))[1] as food_id,
      count(*) as n,
      max(coalesce(m.eaten_at, mi.created_at)) as zuletzt
    from meal_items mi
    join meals m on m.id = mi.meal_id
    left join foods f on f.id = mi.food_id
    where mi.user_id = auth.uid()
      and coalesce(m.eaten_at, mi.created_at) > now() - interval '90 days'
    group by 1
  )
  select
    g.label,
    g.food_id,
    g.n,
    g.zuletzt,
    f.kcal_per_100g,
    f.protein_per_100g,
    f.fat_per_100g,
    f.carbs_per_100g,
    f.fiber_per_100g
  from grouped g
  left join foods f on f.id = g.food_id
  order by g.zuletzt desc, g.n desc
  limit p_limit;
$function$;
