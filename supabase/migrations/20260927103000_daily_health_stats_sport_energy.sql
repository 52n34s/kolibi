-- Persisted sport / training energy for the day (kcal). Written whenever the
-- client computes the day's sport energy; history prefers this over recomputing
-- from active_energy_kcal alone.

begin;

alter table public.daily_health_stats
  add column if not exists sport_energy_kcal numeric(6, 1) null;

notify pgrst, 'reload schema';

commit;
