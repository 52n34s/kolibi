-- Own templates ("Meine Vorlagen") live in workout_templates next to the units.
--
-- is_template = false: a unit of the plan (active while archived_at is null,
--                      "Meine früheren Einheiten" once archived).
-- is_template = true:  a template; archived_at set = removed by the user.
--
-- Existing rows stay units. The four RLS policies of workout_templates already
-- limit every operation to user_id = auth.uid(); nothing to change there.
-- save_workout_template stays as it is: the app writes the flag after saving.
-- Run manually in the SQL Editor.

begin;

alter table public.workout_templates
  add column if not exists is_template boolean not null default false;

create index if not exists workout_templates_user_units_idx
  on public.workout_templates (user_id, position)
  where archived_at is null and not is_template;

notify pgrst, 'reload schema';

commit;
