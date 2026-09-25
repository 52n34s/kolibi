/**
 * True when PostgREST / Postgres report a column, table or relation that the
 * database does not have yet (migration file not run). Callers degrade instead
 * of failing: feature hidden, local fallback.
 *
 * PGRST204 column not in schema cache · PGRST205 table not in schema cache ·
 * 42703 undefined column · 42P01 undefined table.
 */
const MISSING_SCHEMA_CODES = new Set(['PGRST204', 'PGRST205', '42703', '42P01']);

export function isMissingSchemaError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && MISSING_SCHEMA_CODES.has(code)) {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    /(column|relation|table) .* does not exist|in the schema cache/i.test(message)
  );
}
