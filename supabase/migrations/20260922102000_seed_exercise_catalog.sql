insert into public.exercises
  (catalog_slug, names, kind, per_side, default_sets, default_reps, default_seconds, default_rest_seconds, image_asset)
values
  ('ytw_raise',               '{"de":"Y-T-W","en":"Y-T-W Raises","es":"Y-T-W"}',                                         'reps', false, 3, 10, null, 60,  'ytw_raise'),
  ('pull_up',                 '{"de":"Klimmzüge","en":"Pull-ups","es":"Dominadas"}',                                       'reps', false, 3, 6,  null, 120, 'pull_up'),
  ('chin_up',                 '{"de":"Chin-ups","en":"Chin-ups","es":"Dominadas supinas"}',                                'reps', false, 3, 6,  null, 120, 'chin_up'),
  ('inverted_row',            '{"de":"Barren-Rudern","en":"Inverted Rows","es":"Remo invertido"}',                         'reps', false, 3, 10, null, 90,  'inverted_row'),
  ('backpack_row_single_arm', '{"de":"Rucksack-Rudern einarmig","en":"Single-Arm Backpack Row","es":"Remo a una mano con mochila"}', 'reps', true, 3, 12, null, 60, 'backpack_row_single_arm'),
  ('backpack_curl',           '{"de":"Rucksack-Curls","en":"Backpack Curls","es":"Curl con mochila"}',                     'reps', false, 3, 12, null, 60,  'backpack_curl'),
  ('bulgarian_split_squat',   '{"de":"Bulgarian Split Squats","en":"Bulgarian Split Squats","es":"Sentadilla búlgara"}',   'reps', true,  3, 10, null, 90,  'bulgarian_split_squat'),
  ('single_leg_glute_bridge', '{"de":"Einbeiniges Beckenheben","en":"Single-Leg Glute Bridge","es":"Puente de glúteo a una pierna"}', 'reps', true, 3, 12, null, 60, 'single_leg_glute_bridge'),
  ('side_plank',              '{"de":"Seitstütz","en":"Side Plank","es":"Plancha lateral"}',                               'time', true,  3, null, 30, 60,  'side_plank'),
  ('hanging_knee_raise',      '{"de":"Hängendes Knieheben","en":"Hanging Knee Raises","es":"Elevación de rodillas colgado"}', 'reps', false, 3, 10, null, 60, 'hanging_knee_raise'),
  ('parallette_push_up',      '{"de":"Liegestütze auf Parallettes","en":"Parallette Push-ups","es":"Flexiones en paralelas"}', 'reps', false, 3, 10, null, 90, 'parallette_push_up'),
  ('parallel_bar_dip',        '{"de":"Barren-Dips","en":"Parallel Bar Dips","es":"Fondos en paralelas"}',                  'reps', false, 3, 8,  null, 120, 'parallel_bar_dip'),
  ('bench_dip',               '{"de":"Bankdips","en":"Bench Dips","es":"Fondos en banco"}',                                'reps', false, 3, 12, null, 60,  'bench_dip'),
  ('pike_push_up',            '{"de":"Pike Push-ups","en":"Pike Push-ups","es":"Flexiones pike"}',                         'reps', false, 3, 8,  null, 90,  'pike_push_up'),
  ('hollow_hold',             '{"de":"Hollow Hold","en":"Hollow Hold","es":"Hollow hold"}',                                'time', false, 3, null, 30, 60,  'hollow_hold'),
  ('l_sit',                   '{"de":"L-Sit","en":"L-Sit","es":"L-sit"}',                                                  'time', false, 3, null, 15, 90,  'l_sit')
on conflict (catalog_slug) do update set
  names = excluded.names,
  kind = excluded.kind,
  per_side = excluded.per_side,
  default_sets = excluded.default_sets,
  default_reps = excluded.default_reps,
  default_seconds = excluded.default_seconds,
  default_rest_seconds = excluded.default_rest_seconds,
  image_asset = excluded.image_asset,
  updated_at = now();

notify pgrst, 'reload schema';
