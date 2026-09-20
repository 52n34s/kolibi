-- =========================================================
-- 20260920190000_supplement_due_from_start_date.sql
-- Intervall-Fälligkeit wieder ab Startdatum, nicht letzter Einnahme.
-- Ohne Einnahme markierte 0011 jeden Tag ab start_date als fällig —
-- der Verlauf zeigte dann Punkte an Tagen, die der Zeitplan nicht kennt.
-- daily / weekdays / Kur-mit-Pause unverändert. IMMUTABLE (liest keine Intakes).
-- supplement_history zählt Tage als date + n, ohne generate_series-Timestamps.
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
-- =========================================================

create or replace function public.is_supplement_due(
  s public.supplements, p_date date
) returns boolean
language sql immutable as $$
  select case
    when not s.is_active                 then false
    when p_date < s.start_date           then false
    when s.cycle_on_days is not null
         and p_date >= s.cycle_anchor_date
         and ((p_date - s.cycle_anchor_date)
              % (s.cycle_on_days + s.cycle_off_days)) >= s.cycle_on_days
                                         then false
    when s.schedule_kind = 'daily'       then true
    when s.schedule_kind = 'interval'    then ((p_date - s.start_date) % s.interval_days) = 0
    when s.schedule_kind = 'weekdays'    then extract(isodow from p_date)::smallint = any(s.weekdays)
    else false
  end;
$$;

create or replace function public.supplement_history(
  p_from date,
  p_to date
)
returns table (
  supplement_id uuid,
  name text,
  sort_order int,
  day date,
  is_due boolean,
  taken boolean
)
language sql
stable
security invoker
set search_path = public as $$
  select
    s.id,
    s.name,
    s.sort_order,
    (p_from + g.n)::date,
    public.is_supplement_due(s, (p_from + g.n)::date),
    exists (
      select 1
      from public.supplement_intakes i
      where i.supplement_id = s.id
        and i.logged_on = (p_from + g.n)::date
    )
  from public.supplements s
  cross join generate_series(0, p_to - p_from) as g(n)
  where s.user_id = auth.uid()
    and s.is_active
  order by s.sort_order, s.name, 4;
$$;

notify pgrst, 'reload schema';

-- Ende der Datei.
