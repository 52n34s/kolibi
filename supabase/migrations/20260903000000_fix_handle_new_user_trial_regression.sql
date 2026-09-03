-- Live-DB wich seit unbekanntem Zeitpunkt von allen bisherigen Migrationen ab:
-- handle_new_user() setzte trial_ends_at hart auf null für ALLE neuen Nutzer
-- (manuell im SQL Editor, nie committed). Dadurch bekamen neue Nutzer seit
-- mindestens dem 31.08. keinen Trial. Korrekter Stand (CASE: null nur für
-- Anonyme, sonst now() + 3 days) wurde live wiederhergestellt; diese
-- Migration dokumentiert denselben Stand im Repo, damit er nicht erneut
-- verloren geht. Nicht als Deploy nötig, wenn Live bereits korrigiert ist.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE
      WHEN COALESCE(NEW.is_anonymous, false)
        OR COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'anonymous'
      THEN NULL
      ELSE NOW() + INTERVAL '3 days'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
