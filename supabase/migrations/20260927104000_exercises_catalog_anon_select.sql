-- Fix: "Dein Einstieg" (starter plans) preview fails for anonymous users
-- ("Vorschau konnte nicht geladen werden") while working for real accounts.
--
-- apply-starter-plan.ts reads the shared exercise catalog (exercises rows
-- with user_id is null) to build the preview. exercises_select already lets
-- any `authenticated`-role JWT read catalog rows (20260922101000, line 29),
-- and Supabase anonymous sign-ins do hold a real `authenticated` JWT — but
-- `revoke all on public.exercises from anon` (same migration, line 38) means
-- any request that executes as the literal Postgres `anon` role (e.g. a
-- request that goes out before the anonymous session's JWT is fully
-- attached, or a token that briefly lapses) has zero grants and is rejected
-- outright, independent of RLS. The Plan-Assistent never hits this because
-- its catalog is a bundled local dataset, not a Supabase query — it was
-- never actually exercising the same anon path.
--
-- Catalog rows (user_id is null) carry no personal data — they're the same
-- shared exercise list every user reads — so it's safe to let the literal
-- anon role read them directly, closing this gap regardless of why a
-- request ends up unauthenticated.

grant select on public.exercises to anon;

create policy exercises_select_anon_catalog
  on public.exercises
  for select
  to anon
  using (user_id is null);
