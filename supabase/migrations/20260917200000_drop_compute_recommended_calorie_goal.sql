-- Drops the unused server-side copy of the calorie-goal formula.
--
-- public.compute_recommended_calorie_goal was added in 20260714000000 and has
-- no caller anywhere: not in the app, not in an edge function, not in another
-- database function. It still carries the pre-2026-09-17 rules — deficit capped
-- against the BMR, no resting-metabolism floor — so wiring it up later would
-- silently reintroduce the targets we just fixed.
--
-- Run the two checks in the migration notes before applying; Postgres does not
-- track calls made from inside function bodies, so only a source scan is
-- conclusive.
--
-- activity_factor_for_user stays: it was only ever called from the function
-- below, but it is harmless on its own and may be referenced by live SQL that
-- is not represented in this repository.

drop function if exists public.compute_recommended_calorie_goal(uuid);
