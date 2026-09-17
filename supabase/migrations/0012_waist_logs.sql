-- Taillenumfang, ein Eintrag pro lokalem Kalendertag und Nutzer.

create table public.waist_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  waist_cm numeric(5,1) not null check (waist_cm > 30 and waist_cm < 250),
  logged_at timestamptz not null default now(),
  logged_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index waist_logs_user_id_logged_on_idx
  on public.waist_logs (user_id, logged_on);

alter table public.waist_logs enable row level security;

create policy waist_logs_own on public.waist_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.waist_logs to authenticated;

notify pgrst, 'reload schema';
