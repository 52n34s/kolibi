-- §356a BGB withdrawal declarations (user-submitted, refund handled via Apple).

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted',
  user_email text NOT NULL,
  rc_original_transaction_id text,
  note text
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_submitted_at_idx
  ON public.withdrawals (user_id, submitted_at DESC);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own
  ON public.withdrawals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS withdrawals_insert_own ON public.withdrawals;
CREATE POLICY withdrawals_insert_own
  ON public.withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
