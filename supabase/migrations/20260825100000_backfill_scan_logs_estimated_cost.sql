-- Backfill estimated_cost_usd on scan_logs from stored tokens × model rates.
-- Rates last checked 2026-08-25 (Anthropic Haiku 4.5: $1/MTok in, $5/MTok out).
-- Only fills rows that still have NULL cost; uses historical model_version, not today's model.

UPDATE public.scan_logs
SET estimated_cost_usd = ROUND(
  (
    COALESCE(input_tokens, 0)::numeric * CASE model_version
      WHEN 'claude-haiku-4-5' THEN 1.0
      WHEN 'claude-haiku-4-5-20251001' THEN 1.0
      ELSE NULL
    END
    + COALESCE(output_tokens, 0)::numeric * CASE model_version
      WHEN 'claude-haiku-4-5' THEN 5.0
      WHEN 'claude-haiku-4-5-20251001' THEN 5.0
      ELSE NULL
    END
  ) / 1000000.0,
  6
)
WHERE estimated_cost_usd IS NULL
  AND (input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
  AND model_version IN ('claude-haiku-4-5', 'claude-haiku-4-5-20251001');
