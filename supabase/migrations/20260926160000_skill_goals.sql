-- Skill goal ("Könnensziel"): one exercise plus a target value, e.g.
-- 10 archer pull-ups or 30 s L-sit. The app keeps one active goal per user
-- (archived_at is null); achieved_at is set once a set reaches the target.
-- The app hides the feature until this migration has run.
-- Run manually in the SQL Editor.

begin;

create table if not exists public.skill_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  target_value integer not null check (target_value > 0 and target_value <= 10000),
  created_at timestamptz not null default now(),
  achieved_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists skill_goals_one_active_per_user
  on public.skill_goals (user_id)
  where archived_at is null;

alter table public.skill_goals enable row level security;

create policy skill_goals_select_own on public.skill_goals for select to authenticated
  using (user_id = auth.uid());
create policy skill_goals_insert_own on public.skill_goals for insert to authenticated
  with check (user_id = auth.uid());
create policy skill_goals_update_own on public.skill_goals for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy skill_goals_delete_own on public.skill_goals for delete to authenticated
  using (user_id = auth.uid());
-- The exercise must be a catalog row or one of the user's own.
create policy skill_goals_exercise_visible on public.skill_goals
  as restrictive for all to authenticated
  using (true)
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid())
    )
  );

grant select, insert, update, delete on public.skill_goals to authenticated;
revoke all on public.skill_goals from anon;

notify pgrst, 'reload schema';

commit;
