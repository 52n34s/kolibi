-- Run as a separate statement in the SQL editor (Postgres requirement for new checks).
alter table meal_items
  add column display_unit text not null default 'g'
  check (display_unit in ('g', 'ml'));
