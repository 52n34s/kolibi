-- Run manually in Supabase SQL Editor.

ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS names jsonb;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS search_terms text[];
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS usda_ndb text;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS foods_search_terms_gin
  ON public.foods USING gin (search_terms);

CREATE INDEX IF NOT EXISTS foods_name_trgm
  ON public.foods USING gin (name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS foods_usda_ndb_unique
  ON public.foods (usda_ndb);

NOTIFY pgrst, 'reload schema';
