-- Proposal only — do not apply until reviewed.
-- Adds optional progress baseline date for Home weight progress card.

alter table profiles
  add column if not exists progress_start_date date;

notify pgrst, 'reload schema';
