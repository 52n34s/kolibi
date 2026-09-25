-- Release 1.4: read-only checks, one row per migration.
-- ok = true means the migration has run completely. Nothing here writes.
-- Paste into the SQL Editor.

select '20260924152000_beginner_ladder_steps' as migration,
       (select count(*) from public.exercises
         where user_id is null
           and catalog_slug in ('dead_hang', 'active_hang', 'wall_push_up',
                                'elevated_hands_pike_push_up', 'box_squat', 'bodyweight_squat',
                                'lying_leg_raise', 'bench_dip_bent_knees', 'side_plank_knees')) = 9
       and exists (select 1 from public.exercises
                    where user_id is null and catalog_slug = 'chin_up'
                      and ladder_key = 'pull_vertical' and ladder_step = 4)
       and exists (select 1 from public.exercises
                    where user_id is null and catalog_slug = 'pull_up'
                      and ladder_key = 'pull_vertical' and ladder_step = 5) as ok
union all
select '20260925180000_register_push_token',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'register_push_token'
                  and pg_get_function_identity_arguments(p.oid) = 'p_token text, p_platform text, p_device_id text')
union all
select '20260925190000_workout_template_flag',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'workout_templates' and column_name = 'is_template')
       and to_regclass('public.workout_templates_user_units_idx') is not null
union all
select '20260926120000_rir_shortfall_reasons',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'session_sets' and column_name = 'rir')
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'workout_sessions' and column_name = 'shortfall_reasons')
union all
select '20260926123300_profiles_plan_wizard_answers',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'profiles' and column_name = 'plan_wizard_answers')
union all
select '20260926143400_exercise_muscles',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'exercises'
           and column_name in ('primary_muscles', 'secondary_muscles')) = 2
union all
select '20260926153500_body_measurements',
       to_regclass('public.body_measurements') is not null
       and (select count(*) from pg_policies
             where schemaname = 'public' and tablename = 'body_measurements') = 4
union all
select '20260926160000_skill_goals',
       to_regclass('public.skill_goals') is not null
       and (select count(*) from pg_policies
             where schemaname = 'public' and tablename = 'skill_goals') = 5
union all
select '20260926170000_daily_checkins',
       to_regclass('public.daily_checkins') is not null
       and (select count(*) from pg_policies
             where schemaname = 'public' and tablename = 'daily_checkins') = 4
       and (select count(*) from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name in ('checkin_enabled', 'checkin_reminder_time')) = 2
union all
select '20260926183100_add_strength_goal_type',
       exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'goal_type' and e.enumlabel = 'strength')
union all
select '20260926183200_profiles_usage_purpose',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'profiles' and column_name = 'usage_purpose');

-- Not in the release list: pg_cron jobs (20260926190000_cron_jobs).
-- select jobname, schedule, active from cron.job order by jobname;

-- Orphaned training_sessions (phantom "Manuell · Krafttraining"): strength rows
-- no workout session links to, next to the finished units of the same day.
-- Only shows rows, deletes nothing.
-- select ts.id, ts.user_id, ts.logged_on, ts.duration_min, ts.estimated_kcal, ts.created_at,
--        (select count(*) from public.workout_sessions w
--          where w.user_id = ts.user_id and w.logged_on = ts.logged_on
--            and w.finished_at is not null) as finished_units_that_day
--   from public.training_sessions ts
--  where ts.training_type = 'strength'
--    and not exists (select 1 from public.workout_sessions ws where ws.training_session_id = ts.id)
--  order by ts.created_at desc;
