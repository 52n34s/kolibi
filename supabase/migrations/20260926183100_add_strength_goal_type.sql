-- Block 3.1: "Kraft und Skills" as its own goal. Same calorie and macro effect
-- as build_muscle (maintenance calories, protein 1.8 g/kg).
-- The app probes for the value (filter goal_type = 'strength', limit 0) and
-- writes build_muscle plus a local marker until this has run.
-- The new value is not used in this transaction.

begin;

alter type public.goal_type add value if not exists 'strength';

notify pgrst, 'reload schema';

commit;
