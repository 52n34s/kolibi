-- Plan wizard (Block 2.3): last answers so the wizard pre-fills next time.
-- goal, days, minutes, equipment, assessment, cardio as one jsonb object.
-- null = wizard never finished. The app keeps a local copy and works without
-- this column (answers just come from the device).
-- File only, run manually. Existing profiles RLS (own row) covers it.

begin;

alter table public.profiles
  add column if not exists plan_wizard_answers jsonb;

alter table public.profiles
  drop constraint if exists profiles_plan_wizard_answers_object;

alter table public.profiles
  add constraint profiles_plan_wizard_answers_object
  check (plan_wizard_answers is null or jsonb_typeof(plan_wizard_answers) = 'object');

notify pgrst, 'reload schema';

commit;
