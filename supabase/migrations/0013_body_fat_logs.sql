-- =========================================================
-- 0013_body_fat_logs.sql
-- Optional body-fat % logs (manual + HealthKit).
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
--
-- Warum eigene Tabelle statt Spalte an waist_logs:
-- - Andere Einheit, Constraints und Quellenlogik (HealthKit-Bundle).
-- - Unabhängige Tage: Taille ohne Körperfett und umgekehrt.
-- - Paralleles Muster zu weight_logs / waist_logs (unique pro Tag).
-- =========================================================

-- 1) Tabelle
create table public.body_fat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body_fat_pct numeric(4,1) not null
    check (body_fat_pct > 3 and body_fat_pct < 70),
  source text not null
    check (source in ('manual', 'healthkit')),
  -- HealthKit HKSource.bundleIdentifier; null for manual entries.
  -- Used to keep imports on one bioimpedance source.
  source_bundle text,
  logged_at timestamptz not null default now(),
  logged_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- 2) Index
create index body_fat_logs_user_id_logged_on_idx
  on public.body_fat_logs (user_id, logged_on);

-- 3) RLS
alter table public.body_fat_logs enable row level security;

create policy body_fat_logs_own on public.body_fat_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Grants
grant select, insert, update, delete on public.body_fat_logs to authenticated;

notify pgrst, 'reload schema';

-- Ende der Datei.
