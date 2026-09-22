-- Leitern + Progressionsart am Katalog
alter table public.exercises
  add column ladder_key text,
  add column ladder_step smallint check (ladder_step between 1 and 20),
  add column progression_kind text not null default 'variant'
    check (progression_kind in ('variant', 'load', 'none')),
  add column time_cap_seconds smallint check (time_cap_seconds between 5 and 900),
  add column default_reps_max smallint check (default_reps_max between 1 and 200),
  add column default_seconds_max smallint check (default_seconds_max between 1 and 900),
  add constraint exercises_ladder_pair check ((ladder_key is null) = (ladder_step is null));

create unique index exercises_ladder_uniq
  on public.exercises (ladder_key, ladder_step)
  where user_id is null and ladder_key is not null;

-- Entscheidungen zu Vorschlägen (angenommen / abgelehnt)
create table public.progression_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  session_id uuid references public.workout_sessions (id) on delete set null,
  kind text not null check (kind in
    ('variant_up', 'variant_down', 'sets_up', 'range_up', 'range_down', 'time_up', 'load_up')),
  from_exercise_id uuid references public.exercises (id) on delete set null,
  to_exercise_id uuid references public.exercises (id) on delete set null,
  from_target jsonb not null,
  to_target jsonb not null,
  status text not null check (status in ('accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index progression_events_user_idx on public.progression_events (user_id, created_at desc);

alter table public.progression_events enable row level security;
create policy progression_events_select_own on public.progression_events for select to authenticated
  using (user_id = auth.uid());
create policy progression_events_insert_own on public.progression_events for insert to authenticated
  with check (user_id = auth.uid());
create policy progression_events_update_own on public.progression_events for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progression_events_delete_own on public.progression_events for delete to authenticated
  using (user_id = auth.uid());
create policy progression_events_refs_visible on public.progression_events
  as restrictive for all to authenticated
  using (true)
  with check (
    (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid()))
    and (session_id is null or exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
    and (from_exercise_id is null or exists (select 1 from public.exercises e where e.id = from_exercise_id and (e.user_id is null or e.user_id = auth.uid())))
    and (to_exercise_id is null or exists (select 1 from public.exercises e where e.id = to_exercise_id and (e.user_id is null or e.user_id = auth.uid())))
  );
grant select, insert, update, delete on public.progression_events to authenticated;
revoke all on public.progression_events from anon;

-- Bestehende 16 Katalog-Übungen: Leiter, Bereiche, Art
update public.exercises e set
  ladder_key = v.ladder_key,
  ladder_step = v.ladder_step,
  progression_kind = v.kind,
  default_reps = v.rmin,
  default_reps_max = v.rmax,
  default_seconds = v.smin,
  default_seconds_max = v.smax,
  time_cap_seconds = v.cap,
  updated_at = now()
from (values
  ('ytw_raise',               null,               null::int, 'none',    6,    null::int, null::int, null::int, null::int),
  ('pull_up',                 'pull_vertical',    2,         'variant', 3,    8,         null,      null,      null),
  ('chin_up',                 null,               null,      'variant', 3,    8,         null,      null,      null),
  ('inverted_row',            'row',              2,         'variant', 8,    12,        null,      null,      null),
  ('backpack_row_single_arm', null,               null,      'load',    10,   15,        null,      null,      null),
  ('backpack_curl',           null,               null,      'load',    10,   15,        null,      null,      null),
  ('bulgarian_split_squat',   'squat_single',     2,         'variant', 8,    12,        null,      null,      null),
  ('single_leg_glute_bridge', 'bridge',           2,         'variant', 10,   15,        null,      null,      null),
  ('side_plank',              'side_plank',       1,         'variant', null, null,      20,        40,        60),
  ('hanging_knee_raise',      'hanging',          1,         'variant', 8,    15,        null,      null,      null),
  ('parallette_push_up',      'push_horizontal',  3,         'variant', 8,    12,        null,      null,      null),
  ('parallel_bar_dip',        'dip',              2,         'variant', 5,    10,        null,      null,      null),
  ('bench_dip',               'dip',              1,         'variant', 8,    12,        null,      null,      null),
  ('pike_push_up',            'push_vertical',    1,         'variant', 6,    10,        null,      null,      null),
  ('hollow_hold',             'hollow',           2,         'variant', null, null,      20,        30,        60),
  ('l_sit',                   'l_sit',            1,         'variant', null, null,      10,        20,        30)
) as v(slug, ladder_key, ladder_step, kind, rmin, rmax, smin, smax, cap)
where e.catalog_slug = v.slug and e.user_id is null;

-- L-Sit korrekt benennen (Bild und Ausführung sind angehockt)
update public.exercises
   set names = '{"de":"L-Sit angehockt","en":"Tuck L-Sit","es":"L-sit encogido"}', updated_at = now()
 where catalog_slug = 'l_sit' and user_id is null;

-- 23 neue Katalog-Übungen
insert into public.exercises
  (catalog_slug, names, kind, per_side, default_sets, default_reps, default_reps_max,
   default_seconds, default_seconds_max, default_rest_seconds, image_asset,
   ladder_key, ladder_step, progression_kind, time_cap_seconds)
values
  ('incline_push_up',            '{"de":"Schräge Liegestütze","en":"Incline Push-ups","es":"Flexiones inclinadas"}',                                   'reps', false, 3, 8,    15,   null, null, 60,  'incline_push_up',            'push_horizontal', 1, 'variant', null),
  ('push_up',                    '{"de":"Liegestütze","en":"Push-ups","es":"Flexiones"}',                                                               'reps', false, 3, 8,    15,   null, null, 60,  'push_up',                    'push_horizontal', 2, 'variant', null),
  ('archer_push_up',             '{"de":"Archer-Liegestütze","en":"Archer Push-ups","es":"Flexiones arquero"}',                                          'reps', true,  3, 5,    8,    null, null, 90,  'archer_push_up',             'push_horizontal', 4, 'variant', null),
  ('pseudo_planche_push_up',     '{"de":"Pseudo-Planche-Liegestütze","en":"Pseudo Planche Push-ups","es":"Flexiones pseudo plancha"}',                  'reps', false, 3, 5,    10,   null, null, 90,  'pseudo_planche_push_up',     'push_horizontal', 5, 'variant', null),
  ('elevated_pike_push_up',      '{"de":"Pike Push-ups erhöht","en":"Elevated Pike Push-ups","es":"Flexiones pike elevadas"}',                           'reps', false, 3, 6,    10,   null, null, 90,  'elevated_pike_push_up',      'push_vertical',   2, 'variant', null),
  ('wall_handstand_push_up',     '{"de":"Handstand-Liegestütze an der Wand","en":"Wall Handstand Push-ups","es":"Flexiones en pino contra la pared"}',  'reps', false, 3, 3,    8,    null, null, 120, 'wall_handstand_push_up',     'push_vertical',   3, 'variant', null),
  ('straight_bar_dip',           '{"de":"Dips an der geraden Stange","en":"Straight Bar Dips","es":"Fondos en barra recta"}',                           'reps', false, 3, 5,    10,   null, null, 120, 'straight_bar_dip',           'dip',             3, 'variant', null),
  ('negative_pull_up',           '{"de":"Negative Klimmzüge","en":"Negative Pull-ups","es":"Dominadas negativas"}',                                     'reps', false, 3, 3,    6,    null, null, 120, 'negative_pull_up',           'pull_vertical',   1, 'variant', null),
  ('archer_pull_up',             '{"de":"Archer-Klimmzüge","en":"Archer Pull-ups","es":"Dominadas arquero"}',                                           'reps', true,  3, 2,    5,    null, null, 150, 'archer_pull_up',             'pull_vertical',   3, 'variant', null),
  ('inverted_row_bent_knees',    '{"de":"Barren-Rudern, Knie gebeugt","en":"Bent-Knee Inverted Rows","es":"Remo invertido con rodillas flexionadas"}',  'reps', false, 3, 8,    12,   null, null, 90,  'inverted_row_bent_knees',    'row',             1, 'variant', null),
  ('feet_elevated_inverted_row', '{"de":"Barren-Rudern, Füße erhöht","en":"Feet-Elevated Inverted Rows","es":"Remo invertido con pies elevados"}',     'reps', false, 3, 8,    12,   null, null, 90,  'feet_elevated_inverted_row', 'row',             3, 'variant', null),
  ('archer_row',                 '{"de":"Archer-Rudern","en":"Archer Rows","es":"Remo arquero"}',                                                       'reps', true,  3, 5,    8,    null, null, 90,  'archer_row',                 'row',             4, 'variant', null),
  ('split_squat',                '{"de":"Split Squats","en":"Split Squats","es":"Sentadilla dividida"}',                                                'reps', true,  3, 8,    12,   null, null, 60,  'split_squat',                'squat_single',    1, 'variant', null),
  ('pistol_squat_box',           '{"de":"Pistol Squats auf Box","en":"Box Pistol Squats","es":"Sentadilla pistol a caja"}',                            'reps', true,  3, 5,    8,    null, null, 90,  'pistol_squat_box',           'squat_single',    3, 'variant', null),
  ('pistol_squat',               '{"de":"Pistol Squats","en":"Pistol Squats","es":"Sentadilla pistol"}',                                                'reps', true,  3, 3,    6,    null, null, 120, 'pistol_squat',               'squat_single',    4, 'variant', null),
  ('glute_bridge',               '{"de":"Beckenheben","en":"Glute Bridge","es":"Puente de glúteo"}',                                                    'reps', false, 3, 12,   20,   null, null, 60,  'glute_bridge',               'bridge',          1, 'variant', null),
  ('single_leg_hip_thrust',      '{"de":"Einbeiniger Hip Thrust","en":"Single-Leg Hip Thrust","es":"Hip thrust a una pierna"}',                         'reps', true,  3, 10,   15,   null, null, 60,  'single_leg_hip_thrust',      'bridge',          3, 'variant', null),
  ('side_plank_leg_raise',       '{"de":"Seitstütz mit Beinheben","en":"Side Plank with Leg Raise","es":"Plancha lateral con elevación de pierna"}',    'time', true,  2, null, null, 15,   30,   60,  'side_plank_leg_raise',       'side_plank',      2, 'variant', 45),
  ('tuck_hollow_hold',           '{"de":"Hollow Hold angehockt","en":"Tuck Hollow Hold","es":"Hollow hold encogido"}',                                 'time', false, 2, null, null, 20,   40,   60,  'tuck_hollow_hold',           'hollow',          1, 'variant', 60),
  ('one_leg_l_sit',              '{"de":"L-Sit einbeinig","en":"One-Leg L-Sit","es":"L-sit a una pierna"}',                                             'time', true,  2, null, null, 10,   20,   90,  'one_leg_l_sit',              'l_sit',           2, 'variant', 30),
  ('full_l_sit',                 '{"de":"L-Sit","en":"L-Sit","es":"L-sit"}',                                                                            'time', false, 2, null, null, 5,    15,   90,  'full_l_sit',                 'l_sit',           3, 'variant', 30),
  ('hanging_leg_raise',          '{"de":"Hängendes Beinheben","en":"Hanging Leg Raises","es":"Elevación de piernas colgado"}',                          'reps', false, 2, 6,    12,   null, null, 90,  'hanging_leg_raise',          'hanging',         2, 'variant', null),
  ('toes_to_bar',                '{"de":"Toes to Bar","en":"Toes to Bar","es":"Pies a la barra"}',                                                      'reps', false, 2, 5,    10,   null, null, 90,  'toes_to_bar',                'hanging',         3, 'variant', null)
on conflict (catalog_slug) do update set
  names = excluded.names, kind = excluded.kind, per_side = excluded.per_side,
  default_sets = excluded.default_sets, default_reps = excluded.default_reps,
  default_reps_max = excluded.default_reps_max, default_seconds = excluded.default_seconds,
  default_seconds_max = excluded.default_seconds_max, default_rest_seconds = excluded.default_rest_seconds,
  image_asset = excluded.image_asset, ladder_key = excluded.ladder_key, ladder_step = excluded.ladder_step,
  progression_kind = excluded.progression_kind, time_cap_seconds = excluded.time_cap_seconds,
  updated_at = now();

notify pgrst, 'reload schema';
