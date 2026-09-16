-- =========================================================
-- 0010_supplements.sql
-- Supplemente: Zeitplan, Einnahmen, Erinnerungen
-- Am 16.09.2026 manuell im Supabase SQL Editor ausgefuehrt.
-- Nicht erneut ausfuehren.
-- =========================================================

create type schedule_kind as enum ('daily', 'interval', 'weekdays');

create table public.supplements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  dose_amount       numeric(10,2),
  dose_unit         text,
  schedule_kind     schedule_kind not null default 'daily',
  interval_days     int,
  weekdays          smallint[],          -- ISO 1=Mo ... 7=So
  start_date        date not null default current_date,
  cycle_on_days     int,
  cycle_off_days    int,
  cycle_anchor_date date,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint supplements_interval_valid
    check (interval_days is null or interval_days between 1 and 90),

  constraint supplements_weekdays_valid
    check (weekdays is null or weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),

  constraint supplements_schedule_complete check (
       (schedule_kind = 'daily')
    or (schedule_kind = 'interval' and interval_days is not null)
    or (schedule_kind = 'weekdays' and weekdays is not null
        and array_length(weekdays, 1) between 1 and 7)
  ),

  constraint supplements_cycle_complete check (
       (cycle_on_days is null and cycle_off_days is null and cycle_anchor_date is null)
    or (cycle_on_days > 0 and cycle_off_days > 0 and cycle_anchor_date is not null)
  )
);

create index supplements_user_active_idx
  on public.supplements (user_id) where is_active;

create table public.supplement_intakes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  taken_at      timestamptz not null default now(),
  logged_on     date not null,   -- lokaler Tag, kommt vom Client (localDateKey)
  created_at    timestamptz not null default now(),
  unique (supplement_id, logged_on)
);

create index supplement_intakes_user_day_idx
  on public.supplement_intakes (user_id, logged_on);

create table public.supplement_reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  remind_at  time not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.supplement_reminder_items (
  reminder_id   uuid not null references public.supplement_reminders(id) on delete cascade,
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  primary key (reminder_id, supplement_id)
);

-- maximal 3 Erinnerungen pro Nutzer
create or replace function public.enforce_reminder_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.supplement_reminders
      where user_id = new.user_id) >= 3 then
    raise exception 'Maximal 3 Erinnerungen pro Nutzer';
  end if;
  return new;
end;
$$;

create trigger supplement_reminders_limit
  before insert on public.supplement_reminders
  for each row execute function public.enforce_reminder_limit();

-- =========================================================
-- Faelligkeit
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

create or replace function public.supplements_for_day(p_date date)
returns table (
  id uuid, name text, dose_amount numeric, dose_unit text,
  is_due boolean, taken boolean, sort_order int
)
language sql stable security invoker
set search_path = public as $$
  select s.id, s.name, s.dose_amount, s.dose_unit,
         public.is_supplement_due(s, p_date),
         exists (select 1 from supplement_intakes i
                 where i.supplement_id = s.id and i.logged_on = p_date),
         s.sort_order
  from supplements s
  where s.user_id = auth.uid() and s.is_active
  order by s.sort_order, s.name;
$$;

-- =========================================================
-- RLS + Grants
-- =========================================================

alter table public.supplements               enable row level security;
alter table public.supplement_intakes        enable row level security;
alter table public.supplement_reminders      enable row level security;
alter table public.supplement_reminder_items enable row level security;

create policy supplements_own on public.supplements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy supplement_intakes_own on public.supplement_intakes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy supplement_reminders_own on public.supplement_reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy supplement_reminder_items_own on public.supplement_reminder_items
  for all using (exists (
    select 1 from public.supplement_reminders r
    where r.id = reminder_id and r.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.supplement_reminders r
    where r.id = reminder_id and r.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.supplements               to authenticated;
grant select, insert, update, delete on public.supplement_intakes        to authenticated;
grant select, insert, update, delete on public.supplement_reminders      to authenticated;
grant select, insert, update, delete on public.supplement_reminder_items to authenticated;

grant execute on function public.supplements_for_day(date) to authenticated;

-- =========================================================
-- Reminder-Log + serverseitige Faelligkeit (Cron / Edge Function)
-- Nachtraeglich im SQL Editor ausgefuehrt; hier als Source of Truth.
-- =========================================================

create table public.supplement_reminder_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.supplement_reminders(id) on delete cascade,
  sent_on     date not null,
  sent_at     timestamptz not null default now(),
  unique (reminder_id, sent_on)
);

alter table public.supplement_reminder_log enable row level security;

create policy supplement_reminder_log_own on public.supplement_reminder_log
  for select using (user_id = auth.uid());

grant select on public.supplement_reminder_log to authenticated;

create or replace function public.supplements_due_for_user(
  p_user_id uuid,
  p_date date
)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name
  from supplements s
  where s.user_id = p_user_id
    and s.is_active
    and public.is_supplement_due(s, p_date)
    and not exists (
      select 1 from supplement_intakes i
      where i.supplement_id = s.id and i.logged_on = p_date
    )
  order by s.sort_order, s.name;
$$;

revoke all on function public.supplements_due_for_user(uuid, date) from public;
grant execute on function public.supplements_due_for_user(uuid, date) to service_role;

notify pgrst, 'reload schema';

-- Ende der Datei.
