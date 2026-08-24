-- v_daily_active_users (v1) war tot: nur v2 wird vom Admin-Dashboard gelesen.
-- Zwei konkurrierende DAU-Definitionen (eaten_at/UTC vs. created_at/Berlin)
-- sind eine Fehlerquelle bei nachgetragenen Mahlzeiten -> entfernt.
drop view if exists public.v_daily_active_users;

-- Tagesgrenze auf Europe/Berlin, konsistent zu v_daily_active_users_v2.
drop view if exists public.v_scan_stats_daily;

create view public.v_scan_stats_daily with (security_invoker = true) as
select
  (created_at at time zone 'Europe/Berlin')::date as day,
  count(*) as total_scans,
  count(*) filter (where status = 'success')        as success_count,
  count(*) filter (where status = 'timeout')        as timeout_count,
  count(*) filter (where status = 'provider_error') as provider_error_count,
  count(*) filter (where status = 'invalid_json')   as invalid_json_count,
  count(*) filter (where status = 'image_rejected') as image_rejected_count,
  round(avg(latency_ms))   as avg_latency_ms,
  max(latency_ms)          as max_latency_ms,
  sum(estimated_cost_usd)  as total_cost_usd,
  avg(edit_distance_ratio) as avg_edit_distance_ratio
from public.scan_logs
group by 1;

revoke all on public.v_scan_stats_daily from public, anon;
grant select on public.v_scan_stats_daily to authenticated;

notify pgrst, 'reload schema';
