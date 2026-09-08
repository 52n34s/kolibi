-- AFTER INSERT on support_messages → Edge Function support-to-erdi → ErdiKnows tickets.
-- Async via pg_net: the INSERT always commits even if the HTTP call fails.
-- No backfill of existing rows.
--
-- Apply manually in Supabase SQL Editor after substituting AUTH_BEARER.
-- Do not apply via MCP/CLI from the agent. Do not commit real secrets.
--
-- AUTH_BEARER must match either:
--   - Edge Function secret SUPPORT_TO_ERDI_SECRET, or
--   - SUPABASE_SERVICE_ROLE_KEY
-- Also set Edge Function secret ERDI_TOKEN_TICKETS before deploying the function.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.support_messages_notify_erdi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://njhnqusxzorasykhaymy.supabase.co/functions/v1/support-to-erdi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer AUTH_BEARER'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[support_messages_notify_erdi] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_after_insert_erdi ON public.support_messages;

CREATE TRIGGER support_messages_after_insert_erdi
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_messages_notify_erdi();

NOTIFY pgrst, 'reload schema';
