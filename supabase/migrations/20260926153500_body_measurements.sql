-- Body measurements (block 3.5): chest, upper arm, hip, thigh in cm,
-- one row per user and local calendar day.
--
-- The waist stays in public.waist_logs (0012_waist_logs.sql). It has been
-- stored there since 1.2, the weight sheet writes it and mirrors it to Apple
-- Health (HKQuantityTypeIdentifierWaistCircumference). The measurements sheet
-- writes the waist to waist_logs as well, so the waist lives in exactly one
-- table and this one has no waist column.
--
-- Every value is optional; a row needs at least one of them.
-- Run manually in the SQL Editor.

begin;

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  chest_cm numeric(5,1) check (chest_cm is null or (chest_cm > 40 and chest_cm < 250)),
  arm_cm numeric(5,1) check (arm_cm is null or (arm_cm > 10 and arm_cm < 100)),
  hip_cm numeric(5,1) check (hip_cm is null or (hip_cm > 40 and hip_cm < 250)),
  thigh_cm numeric(5,1) check (thigh_cm is null or (thigh_cm > 20 and thigh_cm < 150)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_one_value check (
    chest_cm is not null or arm_cm is not null or hip_cm is not null or thigh_cm is not null
  ),
  unique (user_id, measured_on)
);

create index if not exists body_measurements_user_id_measured_on_idx
  on public.body_measurements (user_id, measured_on);

alter table public.body_measurements enable row level security;

drop policy if exists body_measurements_select_own on public.body_measurements;
create policy body_measurements_select_own on public.body_measurements
  for select to authenticated using (user_id = auth.uid());
drop policy if exists body_measurements_insert_own on public.body_measurements;
create policy body_measurements_insert_own on public.body_measurements
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists body_measurements_update_own on public.body_measurements;
create policy body_measurements_update_own on public.body_measurements
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists body_measurements_delete_own on public.body_measurements;
create policy body_measurements_delete_own on public.body_measurements
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.body_measurements to authenticated;
revoke all on public.body_measurements from anon;

notify pgrst, 'reload schema';

commit;
