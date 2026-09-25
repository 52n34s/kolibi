-- Deload week: end date of the running lighter week, and when we last
-- suggested one (cooldown). Both optional; null means none.

begin;

alter table public.profiles
  add column if not exists deload_until date null;

alter table public.profiles
  add column if not exists deload_suggested_at timestamptz null;

notify pgrst, 'reload schema';

commit;
