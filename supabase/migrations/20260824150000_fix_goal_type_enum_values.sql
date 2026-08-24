-- The production goal_type enum only had maintain, lose, faster_loss, custom.
-- Migrations 20260711020000 and 20260711160000 were never applied, and the
-- base enum used different labels than the client. completeOnboarding then
-- failed with 22P02 whenever a goal other than maintain or custom was chosen —
-- leaving ~40 profiles with goal_type null. Old labels lose and faster_loss
-- remain as unused enum members; no rows reference them.
--
-- Each statement must run separately: Postgres does not allow ALTER TYPE
-- ADD VALUE in the same transaction as subsequent use of the new value.

alter type goal_type add value if not exists 'lose_weight';

alter type goal_type add value if not exists 'faster_weight_loss';

alter type goal_type add value if not exists 'gain_weight';
