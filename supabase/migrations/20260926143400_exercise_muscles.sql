-- Muscle groups for own exercises (Block 3.4).
--
-- Catalog exercises keep their mapping in the app (src/lib/workouts/muscles.ts,
-- keyed by catalog_slug); these columns stay empty on catalog rows. Own
-- exercises store the selection from the exercise editor.
--
-- The existing RLS policies of exercises (select catalog + own, write own)
-- already cover the new columns; nothing to change there.
-- Until this runs, the app hides the muscle selection.
-- Run manually in the SQL Editor.

begin;

alter table public.exercises
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}';

alter table public.exercises
  drop constraint if exists exercises_muscles_known;

alter table public.exercises
  add constraint exercises_muscles_known check (
    primary_muscles <@ array['chest','shoulders','triceps','back','biceps','core','quads','hamstrings','glutes','calves']::text[]
    and secondary_muscles <@ array['chest','shoulders','triceps','back','biceps','core','quads','hamstrings','glutes','calves']::text[]
    and not (primary_muscles && secondary_muscles)
  );

notify pgrst, 'reload schema';

commit;
