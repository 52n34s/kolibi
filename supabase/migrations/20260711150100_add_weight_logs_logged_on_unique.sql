-- One weight_logs row per user per UTC calendar day.
--
-- Approach: GENERATED ALWAYS ... STORED column logged_on
-- Why generated (not trigger): always derived from logged_at, no drift, no trigger maintenance.
-- logged_at remains the source of truth for ordering; logged_on is the day bucket for uniqueness.
--
-- WARNING – data cleanup (step 1):
-- Deletes older duplicate rows when multiple entries exist for the same user_id + UTC day.
-- Keeps only the row with the latest logged_at per (user_id, day).

DELETE FROM public.weight_logs wl
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, (logged_at AT TIME ZONE 'UTC')::date
        ORDER BY logged_at DESC, id DESC
      ) AS row_num
    FROM public.weight_logs
  ) ranked
  WHERE ranked.row_num > 1
) duplicates
WHERE wl.id = duplicates.id;

ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS logged_on date
  GENERATED ALWAYS AS (((logged_at AT TIME ZONE 'UTC')::date)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS weight_logs_user_id_logged_on_key
  ON public.weight_logs (user_id, logged_on);

NOTIFY pgrst, 'reload schema';
