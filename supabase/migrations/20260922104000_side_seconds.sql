alter table public.session_sets
  add column seconds_other_side smallint check (seconds_other_side between 0 and 3600);

notify pgrst, 'reload schema';
