-- Absolute beginner rungs below existing ladders. Renumber in place (no gaps):
-- stepNeighbor requires consecutive ladder_step values starting at 1.
-- Do not run via CLI until reviewed; paste into SQL Editor inside begin/commit as needed.
--
-- Safe to run again: every update sets a fixed step per catalog_slug, the new
-- rungs are upserted by catalog_slug and the whole file is one transaction.
-- Whether it ran: supabase/checks/release-1.4.sql (beginner_ladder_steps).

begin;

-- ---------------------------------------------------------------------------
-- 1) Shift existing rungs upward (highest target step first → unique index safe)
-- ---------------------------------------------------------------------------

-- pull_vertical: … → 3 negative, (4 chin), 5 pull_up, 6 archer
update public.exercises
   set ladder_step = 6, updated_at = now()
 where catalog_slug = 'archer_pull_up' and user_id is null and ladder_key = 'pull_vertical';
update public.exercises
   set ladder_step = 5, updated_at = now()
 where catalog_slug = 'pull_up' and user_id is null and ladder_key = 'pull_vertical';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'negative_pull_up' and user_id is null and ladder_key = 'pull_vertical';

-- push_horizontal: wall(1) + former 1–5 → 2–6
update public.exercises
   set ladder_step = 6, updated_at = now()
 where catalog_slug = 'pseudo_planche_push_up' and user_id is null and ladder_key = 'push_horizontal';
update public.exercises
   set ladder_step = 5, updated_at = now()
 where catalog_slug = 'archer_push_up' and user_id is null and ladder_key = 'push_horizontal';
update public.exercises
   set ladder_step = 4, updated_at = now()
 where catalog_slug = 'parallette_push_up' and user_id is null and ladder_key = 'push_horizontal';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'push_up' and user_id is null and ladder_key = 'push_horizontal';
update public.exercises
   set ladder_step = 2, updated_at = now()
 where catalog_slug = 'incline_push_up' and user_id is null and ladder_key = 'push_horizontal';

-- push_vertical: elevated_hands(1) + former 1–3 → 2–4
update public.exercises
   set ladder_step = 4, updated_at = now()
 where catalog_slug = 'wall_handstand_push_up' and user_id is null and ladder_key = 'push_vertical';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'elevated_pike_push_up' and user_id is null and ladder_key = 'push_vertical';
update public.exercises
   set ladder_step = 2, updated_at = now()
 where catalog_slug = 'pike_push_up' and user_id is null and ladder_key = 'push_vertical';

-- squat_single: box(1), bodyweight(2) + former 1–4 → 3–6
update public.exercises
   set ladder_step = 6, updated_at = now()
 where catalog_slug = 'pistol_squat' and user_id is null and ladder_key = 'squat_single';
update public.exercises
   set ladder_step = 5, updated_at = now()
 where catalog_slug = 'pistol_squat_box' and user_id is null and ladder_key = 'squat_single';
update public.exercises
   set ladder_step = 4, updated_at = now()
 where catalog_slug = 'bulgarian_split_squat' and user_id is null and ladder_key = 'squat_single';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'split_squat' and user_id is null and ladder_key = 'squat_single';

-- hanging: lying(1) + former 1–3 → 2–4
update public.exercises
   set ladder_step = 4, updated_at = now()
 where catalog_slug = 'toes_to_bar' and user_id is null and ladder_key = 'hanging';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'hanging_leg_raise' and user_id is null and ladder_key = 'hanging';
update public.exercises
   set ladder_step = 2, updated_at = now()
 where catalog_slug = 'hanging_knee_raise' and user_id is null and ladder_key = 'hanging';

-- dip: bent_knees(1) + former 1–3 → 2–4
update public.exercises
   set ladder_step = 4, updated_at = now()
 where catalog_slug = 'straight_bar_dip' and user_id is null and ladder_key = 'dip';
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'parallel_bar_dip' and user_id is null and ladder_key = 'dip';
update public.exercises
   set ladder_step = 2, updated_at = now()
 where catalog_slug = 'bench_dip' and user_id is null and ladder_key = 'dip';

-- side_plank: knees(1) + former 1–2 → 2–3
update public.exercises
   set ladder_step = 3, updated_at = now()
 where catalog_slug = 'side_plank_leg_raise' and user_id is null and ladder_key = 'side_plank';
update public.exercises
   set ladder_step = 2, updated_at = now()
 where catalog_slug = 'side_plank' and user_id is null and ladder_key = 'side_plank';

-- ---------------------------------------------------------------------------
-- 2) New catalog exercises (user_id null), upsert by catalog_slug
-- ---------------------------------------------------------------------------
insert into public.exercises
  (catalog_slug, names, kind, per_side, default_sets, default_reps, default_reps_max,
   default_seconds, default_seconds_max, default_rest_seconds, image_asset,
   ladder_key, ladder_step, progression_kind, time_cap_seconds)
values
  ('dead_hang',
   '{"de":"Hängen","en":"Dead Hang","es":"Colgarse"}',
   'time', false, 2, null, null, 15, 30, 60, 'dead_hang',
   'pull_vertical', 1, 'variant', 60),
  ('active_hang',
   '{"de":"Aktives Hängen","en":"Active Hang","es":"Colgarse activo"}',
   'time', false, 2, null, null, 15, 30, 60, 'active_hang',
   'pull_vertical', 2, 'variant', 45),
  ('wall_push_up',
   '{"de":"Liegestütze an der Wand","en":"Wall Push-ups","es":"Flexiones en la pared"}',
   'reps', false, 3, 10, 20, null, null, 60, 'wall_push_up',
   'push_horizontal', 1, 'variant', null),
  ('elevated_hands_pike_push_up',
   '{"de":"Pike Push-ups, Hände erhöht","en":"Elevated-Hands Pike Push-ups","es":"Flexiones pike con manos elevadas"}',
   'reps', false, 3, 6, 12, null, null, 90, 'elevated_hands_pike_push_up',
   'push_vertical', 1, 'variant', null),
  ('box_squat',
   '{"de":"Kniebeuge zur Box","en":"Box Squat","es":"Sentadilla a caja"}',
   'reps', false, 3, 8, 15, null, null, 60, 'box_squat',
   'squat_single', 1, 'variant', null),
  ('bodyweight_squat',
   '{"de":"Kniebeuge","en":"Bodyweight Squat","es":"Sentadilla"}',
   'reps', false, 3, 10, 20, null, null, 60, 'bodyweight_squat',
   'squat_single', 2, 'variant', null),
  ('lying_leg_raise',
   '{"de":"Liegendes Beinheben","en":"Lying Leg Raises","es":"Elevación de piernas tumbado"}',
   'reps', false, 2, 8, 15, null, null, 60, 'lying_leg_raise',
   'hanging', 1, 'variant', null),
  ('bench_dip_bent_knees',
   '{"de":"Bankdips, Knie gebeugt","en":"Bent-Knee Bench Dips","es":"Fondos en banco con rodillas flexionadas"}',
   'reps', false, 3, 8, 15, null, null, 60, 'bench_dip_bent_knees',
   'dip', 1, 'variant', null),
  ('side_plank_knees',
   '{"de":"Seitstütz auf den Knien","en":"Kneeling Side Plank","es":"Plancha lateral de rodillas"}',
   'time', true, 2, null, null, 20, 40, 60, 'side_plank_knees',
   'side_plank', 1, 'variant', 60)
on conflict (catalog_slug) do update set
  names = excluded.names,
  kind = excluded.kind,
  per_side = excluded.per_side,
  default_sets = excluded.default_sets,
  default_reps = excluded.default_reps,
  default_reps_max = excluded.default_reps_max,
  default_seconds = excluded.default_seconds,
  default_seconds_max = excluded.default_seconds_max,
  default_rest_seconds = excluded.default_rest_seconds,
  image_asset = excluded.image_asset,
  ladder_key = excluded.ladder_key,
  ladder_step = excluded.ladder_step,
  progression_kind = excluded.progression_kind,
  time_cap_seconds = excluded.time_cap_seconds,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) chin_up joins pull_vertical between negative_pull_up and pull_up
-- ---------------------------------------------------------------------------
update public.exercises
   set ladder_key = 'pull_vertical',
       ladder_step = 4,
       progression_kind = 'variant',
       updated_at = now()
 where catalog_slug = 'chin_up' and user_id is null;

notify pgrst, 'reload schema';

commit;
