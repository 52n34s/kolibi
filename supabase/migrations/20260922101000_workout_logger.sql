create type public.exercise_kind as enum ('reps', 'weighted', 'time');

-- Übungen: Katalog (user_id null) + eigene
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  catalog_slug text unique,
  names jsonb not null,
  kind public.exercise_kind not null default 'reps',
  per_side boolean not null default false,
  default_sets smallint not null default 3 check (default_sets between 1 and 20),
  default_reps smallint check (default_reps between 1 and 200),
  default_seconds smallint check (default_seconds between 1 and 900),
  default_rest_seconds smallint check (default_rest_seconds between 15 and 600),
  image_asset text,
  image_path text,
  note text check (note is null or char_length(note) <= 200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_catalog_xor_user check ((user_id is null) = (catalog_slug is not null)),
  constraint exercises_target_matches_kind check (
    (kind = 'time' and default_seconds is not null) or (kind <> 'time' and default_reps is not null)
  )
);
create index exercises_user_idx on public.exercises (user_id) where archived_at is null;

alter table public.exercises enable row level security;
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy exercises_insert_own on public.exercises for insert to authenticated
  with check (user_id = auth.uid());
create policy exercises_update_own on public.exercises for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_delete_own on public.exercises for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, update, delete on public.exercises to authenticated;
revoke all on public.exercises from anon;

-- Einheiten (Push, Pull, …)
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  short_label text not null check (char_length(short_label) between 1 and 2),
  color_key text not null default 'indigo'
    check (color_key in ('indigo', 'violet', 'sky', 'teal', 'amber', 'pink')),
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  position smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id) where archived_at is null;

-- Übungen einer Einheit mit Zielwerten
create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null,
  target_sets smallint not null check (target_sets between 1 and 20),
  target_reps smallint check (target_reps between 1 and 200),
  target_seconds smallint check (target_seconds between 1 and 900),
  target_weight_kg numeric(5,1) check (target_weight_kg is null or (target_weight_kg > 0 and target_weight_kg < 500)),
  rest_seconds smallint check (rest_seconds between 15 and 600)
);
create index template_exercises_template_idx on public.template_exercises (template_id, position);

-- Durchgeführte Einheiten (id clientseitig erzeugt → idempotenter Offline-Sync)
create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  template_name text not null,
  short_label text not null,
  color_key text not null,
  logged_on date not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  intensity public.gym_intensity,
  training_session_id uuid references public.training_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at)
);
create index workout_sessions_user_day_idx on public.workout_sessions (user_id, logged_on desc);

-- Einzelne Sätze, Zielwerte als Snapshot
create table public.session_sets (
  id uuid primary key,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  exercise_position smallint not null,
  set_index smallint not null,
  kind public.exercise_kind not null,
  per_side boolean not null default false,
  target_reps smallint,
  target_seconds smallint,
  target_weight_kg numeric(5,1),
  reps smallint check (reps between 0 and 500),
  seconds smallint check (seconds between 0 and 3600),
  weight_kg numeric(5,1),
  completed_at timestamptz not null default now(),
  unique (session_id, exercise_position, set_index)
);
create index session_sets_user_exercise_idx on public.session_sets (user_id, exercise_id, completed_at desc);

-- Standard-RLS + Grants für die vier Nutzer-Tabellen
do $$
declare t text;
begin
  foreach t in array array['workout_templates','template_exercises','workout_sessions','session_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete_own', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Eltern-/Referenz-Besitz zusätzlich erzwingen (FKs umgehen RLS)
create policy template_exercises_parent_own on public.template_exercises
  as restrictive for all to authenticated
  using (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  )
  with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );

create policy session_sets_parent_own on public.session_sets
  as restrictive for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- Einheit atomar speichern (Kopf + komplette Übungsliste)
create or replace function public.save_workout_template(p_template jsonb, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_weekdays smallint[] := array(select value::smallint from jsonb_array_elements_text(coalesce(p_template->'weekdays', '[]'::jsonb)));
begin
  if nullif(p_template->>'id', '') is null then
    insert into workout_templates (name, short_label, color_key, weekdays, position)
    values (
      btrim(p_template->>'name'),
      p_template->>'short_label',
      coalesce(p_template->>'color_key', 'indigo'),
      v_weekdays,
      coalesce((p_template->>'position')::smallint, 0)
    )
    returning id into v_id;
  else
    v_id := (p_template->>'id')::uuid;
    update workout_templates
       set name = btrim(p_template->>'name'),
           short_label = p_template->>'short_label',
           color_key = coalesce(p_template->>'color_key', color_key),
           weekdays = v_weekdays,
           updated_at = now()
     where id = v_id;
    if not found then
      raise exception 'workout template not found' using errcode = 'P0002';
    end if;
    delete from template_exercises where template_id = v_id;
  end if;

  insert into template_exercises
    (template_id, exercise_id, position, target_sets, target_reps, target_seconds, target_weight_kg, rest_seconds)
  select
    v_id,
    (e->>'exercise_id')::uuid,
    (ord - 1)::smallint,
    (e->>'target_sets')::smallint,
    nullif(e->>'target_reps', '')::smallint,
    nullif(e->>'target_seconds', '')::smallint,
    nullif(e->>'target_weight_kg', '')::numeric,
    nullif(e->>'rest_seconds', '')::smallint
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as t(e, ord);

  return v_id;
end;
$$;
revoke execute on function public.save_workout_template(jsonb, jsonb) from public, anon;
grant execute on function public.save_workout_template(jsonb, jsonb) to authenticated;

-- Storage für eigene Übungsbilder (Avatar-Muster)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-images', 'exercise-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy exercise_images_select_own on storage.objects for select to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy exercise_images_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy exercise_images_update_own on storage.objects for update to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy exercise_images_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
