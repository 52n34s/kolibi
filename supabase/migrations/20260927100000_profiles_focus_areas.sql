-- Optional focus areas from the goals screen (up to three). The app clamps
-- the list client-side; the column only stores the chosen ids.

begin;

alter table public.profiles
  add column if not exists focus_areas text[] null;

notify pgrst, 'reload schema';

commit;
