-- product_id from RevenueCat / App Store for withdrawal records.

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS product_id text;

NOTIFY pgrst, 'reload schema';
