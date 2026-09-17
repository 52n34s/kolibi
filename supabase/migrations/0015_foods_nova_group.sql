-- =========================================================
-- 0015_foods_nova_group.sql
-- NOVA processing group (1–4) on cached Open Food Facts foods.
-- Manuell im Supabase SQL Editor ausführen, dann hier ablegen.
-- Nicht erneut ausführen.
-- =========================================================

alter table public.foods
  add column if not exists nova_group smallint
  check (nova_group is null or nova_group between 1 and 4);
