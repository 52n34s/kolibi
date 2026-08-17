-- Anonymous trial scan usage (per auth user + device).

CREATE TABLE IF NOT EXISTS public.anonymous_scan_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  device_id text NOT NULL,
  scan_count int NOT NULL DEFAULT 0,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anonymous_scan_usage_device_id_idx
  ON public.anonymous_scan_usage (device_id);

ALTER TABLE public.anonymous_scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY anonymous_scan_usage_select_own
  ON public.anonymous_scan_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY anonymous_scan_usage_insert_own
  ON public.anonymous_scan_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY anonymous_scan_usage_update_own
  ON public.anonymous_scan_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_scan_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.anonymous_scan_usage
  SET scan_count = scan_count + 1
  WHERE user_id = p_user_id
  RETURNING scan_count INTO v_scan_count;

  IF v_scan_count IS NULL THEN
    RAISE EXCEPTION 'anonymous_scan_usage row not found';
  END IF;

  RETURN v_scan_count;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON TABLE public.anonymous_scan_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_scan_count(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
