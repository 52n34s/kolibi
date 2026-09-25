-- Block 3.1: "Wofür nutzt du Kolibi?" from the onboarding.
-- Optional column. The app probes for it (select … limit 0) and keeps the
-- answer on the device until this has run.

begin;

alter table public.profiles
  add column if not exists usage_purpose text
    constraint profiles_usage_purpose_values check (
      usage_purpose in ('nutrition', 'training', 'both')
    );

notify pgrst, 'reload schema';

commit;
