-- =========================================================
-- 0018_top_nutrient_sources.sql
-- top_nutrient_sources: top meal-item contributors for one macro
-- in a 7/30-day window, folded by localized name (kolibi_fold).
-- top_nutrient_source_stats: window counters for the same filters
-- (used when the list is empty so the client can still show a hint).
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
-- Nicht erneut ausführen.
-- =========================================================
--
-- portion_factor (meal_items): exists; macros (protein_g / …) are absolute
-- grams for the captured plate row. recompute_meal_totals scales with
-- coalesce(portion_factor, 1) for meal totals — same here, not double-count.
--
-- Coverage (valued_item_count * 2 <= item_count) is decided in TypeScript,
-- not via a sentinel null row from this function.

create or replace function public.top_nutrient_sources(
  p_nutrient text,
  p_days integer default 7,
  p_limit integer default 5,
  p_lang text default 'en'
)
returns table (
  label text,
  total_g numeric,
  share_pct numeric,
  n bigint,
  period_total_g numeric,
  valued_item_count bigint,
  item_count bigint
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_lang text := lower(split_part(coalesce(nullif(trim(p_lang), ''), 'en'), '-', 1));
  v_days integer := case when p_days in (7, 30) then p_days else 7 end;
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_nutrient text := lower(trim(p_nutrient));
begin
  if v_nutrient not in ('protein', 'carbs', 'fat', 'fiber') then
    raise exception 'top_nutrient_sources: p_nutrient must be protein|carbs|fat|fiber';
  end if;

  return query
  with windowed as (
    select
      kolibi_fold(
        coalesce(
          nullif(trim(f.names ->> v_lang), ''),
          nullif(trim(f.names ->> 'en'), ''),
          mi.name
        )
      ) as fold_key,
      coalesce(
        nullif(trim(f.names ->> v_lang), ''),
        nullif(trim(f.names ->> 'en'), ''),
        mi.name
      ) as display_name,
      case v_nutrient
        when 'protein' then mi.protein_g
        when 'carbs' then mi.carbs_g
        when 'fat' then mi.fat_g
        when 'fiber' then mi.fiber_g
      end as nutrient_g,
      coalesce(mi.portion_factor, 1)::numeric as portion_factor
    from meal_items mi
    join meals m on m.id = mi.meal_id
    left join foods f on f.id = mi.food_id
    where mi.user_id = auth.uid()
      and coalesce(m.eaten_at, mi.created_at) > now() - make_interval(days => v_days)
  ),
  stats as (
    select
      count(*)::bigint as item_count,
      count(nutrient_g)::bigint as valued_item_count,
      coalesce(
        sum(
          case
            when nutrient_g is null then null
            else nutrient_g * portion_factor
          end
        ),
        0
      )::numeric as period_total_g
    from windowed
  ),
  ranked as (
    select
      max(w.display_name) as label,
      sum(w.nutrient_g * w.portion_factor)::numeric as total_g,
      count(*)::bigint as n
    from windowed w
    where w.nutrient_g is not null
    group by w.fold_key
    having sum(w.nutrient_g * w.portion_factor) > 0
    order by sum(w.nutrient_g * w.portion_factor) desc, max(w.display_name) asc
    limit v_limit
  )
  select
    r.label,
    round(r.total_g, 1) as total_g,
    case
      when s.period_total_g > 0 then round((r.total_g / s.period_total_g) * 100, 0)
      else 0::numeric
    end as share_pct,
    r.n,
    round(s.period_total_g, 1) as period_total_g,
    s.valued_item_count,
    s.item_count
  from ranked r
  cross join stats s;
end;
$function$;

-- Same window + nutrient filter, counters only. Call when the list RPC
-- returns [] so the client can still decide list vs coverage hint.
create or replace function public.top_nutrient_source_stats(
  p_nutrient text,
  p_days integer default 7
)
returns table (
  period_total_g numeric,
  valued_item_count bigint,
  item_count bigint
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_days integer := case when p_days in (7, 30) then p_days else 7 end;
  v_nutrient text := lower(trim(p_nutrient));
begin
  if v_nutrient not in ('protein', 'carbs', 'fat', 'fiber') then
    raise exception 'top_nutrient_source_stats: p_nutrient must be protein|carbs|fat|fiber';
  end if;

  return query
  with windowed as (
    select
      case v_nutrient
        when 'protein' then mi.protein_g
        when 'carbs' then mi.carbs_g
        when 'fat' then mi.fat_g
        when 'fiber' then mi.fiber_g
      end as nutrient_g,
      coalesce(mi.portion_factor, 1)::numeric as portion_factor
    from meal_items mi
    join meals m on m.id = mi.meal_id
    where mi.user_id = auth.uid()
      and coalesce(m.eaten_at, mi.created_at) > now() - make_interval(days => v_days)
  )
  select
    coalesce(
      sum(
        case
          when nutrient_g is null then null
          else nutrient_g * portion_factor
        end
      ),
      0
    )::numeric as period_total_g,
    count(nutrient_g)::bigint as valued_item_count,
    count(*)::bigint as item_count
  from windowed;
end;
$function$;

grant execute on function public.top_nutrient_sources(text, integer, integer, text)
  to authenticated;

grant execute on function public.top_nutrient_source_stats(text, integer)
  to authenticated;
