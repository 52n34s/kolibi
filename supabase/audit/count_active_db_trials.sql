-- Diagnostic only — do not run as a migration.
-- How many accounts still have an active Supabase trial (trial_ends_at in the future)?

SELECT
  COUNT(*) FILTER (WHERE trial_ends_at > NOW()) AS active_db_trials,
  COUNT(*) FILTER (
    WHERE trial_ends_at IS NOT NULL AND trial_ends_at <= NOW()
  ) AS expired_db_trials,
  COUNT(*) FILTER (WHERE trial_ends_at IS NULL) AS never_had_db_trial,
  COUNT(*) AS profiles_total
FROM public.profiles;

-- Optional detail list (newest first):
-- SELECT id, display_name, trial_ends_at
-- FROM public.profiles
-- WHERE trial_ends_at > NOW()
-- ORDER BY trial_ends_at ASC;
