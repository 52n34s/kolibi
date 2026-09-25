-- Block 2.5: reps in reserve per set + "Was war los?" reasons per session.
-- Both columns are optional. The app probes for them (select … limit 0) and
-- only writes them once they exist, so this can ship after the app update.

begin;

-- 0, 1, 2 = reps that would still have been possible; 3 = "3 or more".
alter table public.session_sets
  add column if not exists rir smallint
    constraint session_sets_rir_range check (rir between 0 and 3);

-- Voluntary reasons picked on the summary when an exercise fell clearly short.
alter table public.workout_sessions
  add column if not exists shortfall_reasons text[]
    constraint workout_sessions_shortfall_reasons_values check (
      shortfall_reasons <@ array['tired', 'pain', 'technique', 'short_on_time', 'too_hard']::text[]
    );

notify pgrst, 'reload schema';

commit;
