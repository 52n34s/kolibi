alter table public.template_exercises
  add column target_reps_max smallint,
  add column target_seconds_max smallint,
  add constraint template_exercises_reps_range check (
    target_reps_max is null or (target_reps is not null and target_reps_max >= target_reps and target_reps_max <= 200)
  ),
  add constraint template_exercises_seconds_range check (
    target_seconds_max is null or (target_seconds is not null and target_seconds_max >= target_seconds and target_seconds_max <= 900)
  );

alter table public.session_sets
  add column target_reps_max smallint,
  add column target_seconds_max smallint;

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
    (template_id, exercise_id, position, target_sets,
     target_reps, target_reps_max, target_seconds, target_seconds_max,
     target_weight_kg, rest_seconds)
  select
    v_id,
    (e->>'exercise_id')::uuid,
    (ord - 1)::smallint,
    (e->>'target_sets')::smallint,
    nullif(e->>'target_reps', '')::smallint,
    nullif(e->>'target_reps_max', '')::smallint,
    nullif(e->>'target_seconds', '')::smallint,
    nullif(e->>'target_seconds_max', '')::smallint,
    nullif(e->>'target_weight_kg', '')::numeric,
    nullif(e->>'rest_seconds', '')::smallint
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as t(e, ord);

  return v_id;
end;
$$;
revoke execute on function public.save_workout_template(jsonb, jsonb) from public, anon;
grant execute on function public.save_workout_template(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
