-- Release 1.4: which of the eleven migrations have run. Read-only.
-- One statement, one row per migration, so the SQL Editor shows everything
-- in one result. Only catalog views (information_schema, pg_proc, pg_enum,
-- pg_policies, pg_class) are read for the new objects, so the query also
-- works while a table is still missing. The one table read directly,
-- public.exercises, exists since 1.3.

select nr, migration, case when ok then 'ja' else 'nein' end as ausgefuehrt, detail
from (
  select 1 as nr,
         '20260924152000_beginner_ladder_steps' as migration,
         ladder.rungs = 9 and ladder.chin_step = 4 as ok,
         'Einsteiger-Stufen ' || ladder.rungs || ' von 9, chin_up auf pull_vertical Stufe '
           || coalesce(ladder.chin_step::text, 'keine') || ' (erwartet 4)' as detail
    from (
      select
        (select count(*) from public.exercises
          where user_id is null
            and catalog_slug in ('dead_hang', 'active_hang', 'wall_push_up',
                                 'elevated_hands_pike_push_up', 'box_squat', 'bodyweight_squat',
                                 'lying_leg_raise', 'bench_dip_bent_knees', 'side_plank_knees')) as rungs,
        (select ladder_step from public.exercises
          where user_id is null and catalog_slug = 'chin_up' and ladder_key = 'pull_vertical'
          limit 1) as chin_step
    ) as ladder

  union all
  select 2, '20260925180000_register_push_token',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'register_push_token'
                    and pg_get_function_identity_arguments(p.oid)
                        = 'p_token text, p_platform text, p_device_id text'),
         'Funktion public.register_push_token(text, text, text)'

  union all
  select 3, '20260925190000_workout_template_flag',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'workout_templates'
                    and column_name = 'is_template')
         and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relname = 'workout_templates_user_units_idx'),
         'Spalte workout_templates.is_template und Index workout_templates_user_units_idx'

  union all
  select 4, '20260926120000_rir_shortfall_reasons',
         (select count(*) from information_schema.columns
           where table_schema = 'public'
             and ((table_name = 'session_sets' and column_name = 'rir')
               or (table_name = 'workout_sessions' and column_name = 'shortfall_reasons'))) = 2,
         'Spalten session_sets.rir und workout_sessions.shortfall_reasons'

  union all
  select 5, '20260926123300_profiles_plan_wizard_answers',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'plan_wizard_answers'),
         'Spalte profiles.plan_wizard_answers'

  union all
  select 6, '20260926143400_exercise_muscles',
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'exercises'
             and column_name in ('primary_muscles', 'secondary_muscles')) = 2,
         'Spalten exercises.primary_muscles und secondary_muscles'

  union all
  select 7, '20260926153500_body_measurements',
         exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'body_measurements')
         and (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'body_measurements') = 4,
         'Tabelle body_measurements, Policies '
           || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'body_measurements') || ' von 4'

  union all
  select 8, '20260926160000_skill_goals',
         exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'skill_goals')
         and (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'skill_goals') = 5,
         'Tabelle skill_goals, Policies '
           || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'skill_goals') || ' von 5'

  union all
  select 9, '20260926170000_daily_checkins',
         exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'daily_checkins')
         and (select count(*) from pg_policies
               where schemaname = 'public' and tablename = 'daily_checkins') = 4
         and (select count(*) from information_schema.columns
               where table_schema = 'public' and table_name = 'profiles'
                 and column_name in ('checkin_enabled', 'checkin_reminder_time')) = 2,
         'Tabelle daily_checkins, Policies '
           || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'daily_checkins')
           || ' von 4, Spalten profiles.checkin_enabled und checkin_reminder_time'

  union all
  select 10, '20260926183100_add_strength_goal_type',
         exists (select 1 from pg_enum e
                   join pg_type t on t.oid = e.enumtypid
                   join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'goal_type'
                    and e.enumlabel = 'strength'),
         'Enum-Wert goal_type.strength'

  union all
  select 11, '20260926183200_profiles_usage_purpose',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'usage_purpose'),
         'Spalte profiles.usage_purpose'
) as checks
order by nr;
