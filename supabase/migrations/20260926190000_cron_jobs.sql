-- pg_cron jobs as code. Mirrors the jobs set up by hand in the dashboard.
-- Idempotent: an existing job with the same name is unscheduled first, then
-- scheduled again with the definition below. Running it twice leaves one job
-- per name.
--
-- Needs pg_cron and pg_net (both already enabled on the project) and the
-- vault secrets 'project_url' and 'cron_secret'. No secret is stored here.
--
-- Not part of the 1.4 release list: jobs are infrastructure, not app code.

do $$
declare
  job_name text;
begin
  foreach job_name in array array[
    'send-meal-reminders-every-30-min',
    'compute-meal-time-stats-daily',
    'cleanup-anonymous-users',
    'purge-scan-logs',
    'send-supplement-reminders'
  ]
  loop
    if exists (select 1 from cron.job where jobname = job_name) then
      perform cron.unschedule(job_name);
    end if;
  end loop;
end
$$;

select cron.schedule(
  'send-meal-reminders-every-30-min',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-meal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $cron$
);

select cron.schedule(
  'compute-meal-time-stats-daily',
  '15 2 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/compute-meal-time-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $cron$
);

select cron.schedule(
  'cleanup-anonymous-users',
  '0 3 * * *',
  $cron$ select public.cleanup_stale_anonymous_users() $cron$
);

select cron.schedule(
  'purge-scan-logs',
  '30 3 * * *',
  $cron$ select public.purge_old_scan_logs() $cron$
);

select cron.schedule(
  'send-supplement-reminders',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-supplement-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $cron$
);

-- Check (read-only):
-- select jobname, schedule, active, command from cron.job
--  where jobname in ('send-meal-reminders-every-30-min', 'compute-meal-time-stats-daily',
--                    'cleanup-anonymous-users', 'purge-scan-logs', 'send-supplement-reminders')
--  order by jobname;
