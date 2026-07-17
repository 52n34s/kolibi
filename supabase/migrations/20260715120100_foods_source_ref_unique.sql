-- Run manually in SQL Editor if no unique constraint on (source, source_ref) exists yet.

CREATE UNIQUE INDEX IF NOT EXISTS foods_source_ref_unique
  ON public.foods (source, source_ref)
  WHERE source_ref IS NOT NULL;
