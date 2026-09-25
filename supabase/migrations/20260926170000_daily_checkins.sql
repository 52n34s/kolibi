-- Block 3.2: morning check-in (sleep, energy, soreness, stress) + profile switches.
-- The app probes for the table and the columns and hides the check-in until
-- this ran, so it can ship after the app update.

begin;

-- One answer per user and local day; answering again updates the row.
-- 1 = low … 5 = high for every value (soreness 5 = very sore, stress 5 = very stressed).
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checkin_date date not null,
  sleep smallint not null constraint daily_checkins_sleep_range check (sleep between 1 and 5),
  energy smallint not null constraint daily_checkins_energy_range check (energy between 1 and 5),
  soreness smallint not null constraint daily_checkins_soreness_range check (soreness between 1 and 5),
  stress smallint not null constraint daily_checkins_stress_range check (stress between 1 and 5),
  created_at timestamptz not null default now(),
  constraint daily_checkins_user_date_key unique (user_id, checkin_date)
);

alter table public.daily_checkins enable row level security;

create policy daily_checkins_select_own on public.daily_checkins for select to authenticated
  using (user_id = auth.uid());
create policy daily_checkins_insert_own on public.daily_checkins for insert to authenticated
  with check (user_id = auth.uid());
create policy daily_checkins_update_own on public.daily_checkins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_checkins_delete_own on public.daily_checkins for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.daily_checkins to authenticated;
revoke all on public.daily_checkins from anon;

-- Card on the Today screen on/off ("Nicht mehr anzeigen" sets false).
alter table public.profiles
  add column if not exists checkin_enabled boolean not null default true;

-- Optional local reminder at wake-up time; null = off.
alter table public.profiles
  add column if not exists checkin_reminder_time time;

notify pgrst, 'reload schema';

commit;
