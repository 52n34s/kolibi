-- Orphaned training_sessions (phantom "Manuell · Krafttraining"). Read-only,
-- one statement, deletes nothing.
-- Strength rows that no workout session links to. finished_units_that_day > 0
-- means a finished Kolibi unit on the same day: almost certainly a phantom.
-- 0 can also be a real manual entry.

select ts.id,
       ts.user_id,
       ts.logged_on,
       ts.duration_min,
       ts.estimated_kcal,
       ts.created_at,
       (select count(*) from public.workout_sessions w
         where w.user_id = ts.user_id
           and w.logged_on = ts.logged_on
           and w.finished_at is not null) as finished_units_that_day
  from public.training_sessions ts
 where ts.training_type = 'strength'
   and not exists (select 1 from public.workout_sessions ws
                    where ws.training_session_id = ts.id)
 order by ts.created_at desc;
