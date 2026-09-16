-- =========================================================
-- 0011_supplement_interval_from_last_intake.sql
-- Intervall-Fälligkeit ab letzter Einnahme; supplement_history RPC.
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
-- =========================================================

-- Intervall: fällig, wenn seit der letzten Einnahme (logged_on < p_date)
-- mindestens interval_days vergangen sind. Ohne vorherige Einnahme ist
-- start_date der erste Fälligkeitstag — äquivalent zu Bezug
-- (start_date - interval_days), damit dieselbe >=-Regel greift.
-- Bei interval wandert der Rhythmus mit der letzten Einnahme mit. Nach
-- einer ausgelassenen Einnahme bleibt das Supplement faellig, bis es
-- eingetragen wird — die Angabe beschreibt den heutigen Zustand, nicht
-- einen Rueckstand.
-- daily / weekdays unverändert. STABLE statt IMMUTABLE (liest intakes).

create or replace function public.is_supplement_due(
  s public.supplements, p_date date
) returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when not s.is_active                 then false
    when p_date < s.start_date           then false
    when s.cycle_on_days is not null
         and p_date >= s.cycle_anchor_date
         and ((p_date - s.cycle_anchor_date)
              % (s.cycle_on_days + s.cycle_off_days)) >= s.cycle_on_days
                                         then false
    when s.schedule_kind = 'daily'       then true
    when s.schedule_kind = 'interval'    then
      (p_date - coalesce(
         (select max(i.logged_on)
            from public.supplement_intakes i
           where i.supplement_id = s.id
             and i.logged_on < p_date),
         s.start_date - s.interval_days
       )) >= s.interval_days
    when s.schedule_kind = 'weekdays'    then
      extract(isodow from p_date)::smallint = any(s.weekdays)
    else false
  end;
$$;

-- supplements_for_day / supplements_due_for_user rufen is_supplement_due
-- weiter auf und brauchen kein Rewrite.

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
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.sort_order,
    d.day::date,
    public.is_supplement_due(s, d.day::date),
    exists (
      select 1
      from public.supplement_intakes i
      where i.supplement_id = s.id
        and i.logged_on = d.day::date
    )
  from public.supplements s
  cross join lateral generate_series(p_from, p_to, interval '1 day') as d(day)
  where s.user_id = auth.uid()
    and s.is_active
  order by s.sort_order, s.name, d.day;
$$;

grant execute on function public.supplement_history(date, date) to authenticated;

notify pgrst, 'reload schema';

-- Ende der Datei.
