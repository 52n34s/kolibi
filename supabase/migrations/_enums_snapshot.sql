-- =============================================================================
-- DOCUMENTATION ONLY — DO NOT EXECUTE
--
-- This file is a snapshot of Postgres enum types that exist in the live Kolibi
-- database but are not fully represented as CREATE TYPE migrations in the repo.
-- It is never applied by `supabase db` / CI. Do not run it in the SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- goal_type
-- Live history (chat / 20260824150000_fix_goal_type_enum_values.sql):
--   Base production labels: maintain, lose, faster_loss, custom
--   Added 2026-08-24: lose_weight, faster_weight_loss, gain_weight
-- ---------------------------------------------------------------------------
-- lose and faster_loss are dead (replaced by lose_weight / faster_weight_loss
-- on 2026-08-24). Postgres cannot drop enum labels; no rows reference them;
-- the client never sends them.
CREATE TYPE public.goal_type AS ENUM (
  'maintain',
  'lose',              -- dead; do not use
  'faster_loss',       -- dead; do not use
  'custom',
  'lose_weight',
  'faster_weight_loss',
  'gain_weight'
);

-- ---------------------------------------------------------------------------
-- calorie_goal_source
-- Chat / 20260711150000_add_custom_calorie_goal_source.sql:
--   Before custom: calculated, manual
--   Then added: custom
-- manual appears in no row (unused legacy label).
-- ---------------------------------------------------------------------------
CREATE TYPE public.calorie_goal_source AS ENUM (
  'calculated',
  'manual',            -- unused; no rows
  'custom'
);

-- ---------------------------------------------------------------------------
-- access_override_type
-- From 20260711130100_add_subscription_access_override.sql / prior chat.
-- ---------------------------------------------------------------------------
CREATE TYPE public.access_override_type AS ENUM (
  'none',
  'free_forever',
  'free_until'
);

-- ---------------------------------------------------------------------------
-- macro_goal_source
-- OFFEN: Kein pg_enum-Dump im Chat. Client schreibt bisher nur:
--   'calculated' | 'custom' (plus NULL auf der Spalte).
-- Ob die Live-DB weitere Labels hat, ist unbestätigt.
-- ---------------------------------------------------------------------------
CREATE TYPE public.macro_goal_source AS ENUM (
  'calculated',
  'custom'
  -- weitere Labels: OFFEN
);

-- ---------------------------------------------------------------------------
-- movement_goal_type
-- From prior chat (profiles.movement_goal_* diagnosis).
-- ---------------------------------------------------------------------------
CREATE TYPE public.movement_goal_type AS ENUM (
  'steps',
  'running_km',
  'distance_km'
);

-- ---------------------------------------------------------------------------
-- movement_goal_period
-- From prior chat (profiles.movement_goal_* diagnosis).
-- ---------------------------------------------------------------------------
CREATE TYPE public.movement_goal_period AS ENUM (
  'day',
  'week'
);

-- ---------------------------------------------------------------------------
-- schedule_kind
-- From 0010_supplements.sql (public.supplements.schedule_kind).
-- ---------------------------------------------------------------------------
CREATE TYPE public.schedule_kind AS ENUM (
  'daily',
  'interval',
  'weekdays'
);

-- ---------------------------------------------------------------------------
-- exercise_kind
-- From 20260922101000_workout_logger.sql (public.exercises.kind,
-- public.session_sets.kind).
-- ---------------------------------------------------------------------------
CREATE TYPE public.exercise_kind AS ENUM (
  'reps',
  'weighted',
  'time'
);

-- ---------------------------------------------------------------------------
-- training_type
-- Live public.training_sessions.training_type (manual logger activities).
-- ---------------------------------------------------------------------------
CREATE TYPE public.training_type AS ENUM (
  'strength',
  'yoga',
  'swimming',
  'cycling',
  'other'
);

-- ---------------------------------------------------------------------------
-- gym_intensity
-- Live intensity enum on training_sessions / workout_sessions (talk-test).
-- ---------------------------------------------------------------------------
CREATE TYPE public.gym_intensity AS ENUM (
  'easy',
  'normal',
  'hard'
);
