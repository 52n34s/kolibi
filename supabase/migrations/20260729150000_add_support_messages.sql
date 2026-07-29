-- Support messages submitted from Settings → Support.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (
      category IN (
        'bug',
        'data_issue',
        'feature_request',
        'security_concern',
        'question',
        'praise',
        'other'
      )
    ),
  message text NOT NULL,
  app_version text,
  platform text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_user_id_created_at_idx
  ON public.support_messages (user_id, created_at DESC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_insert_own ON public.support_messages;
CREATE POLICY support_messages_insert_own
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
