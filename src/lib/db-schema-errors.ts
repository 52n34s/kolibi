/**
 * Columns and tables from migrations that may not have run yet. Code that
 * needs them checks first and hides the feature instead of failing.
 */

export type DbError = { code?: string | null; message?: string | null } | null | undefined;

/**
 * 42703 undefined column, 42P01 undefined table (Postgres);
 * PGRST204 column not in schema cache, PGRST205 table not in schema cache,
 * PGRST202 function not in schema cache (PostgREST).
 */
const MISSING_SCHEMA_CODES = new Set(['42703', '42P01', 'PGRST204', 'PGRST205', 'PGRST202']);

export function isMissingSchemaError(error: DbError): boolean {
  if (!error?.code) {
    return false;
  }
  return MISSING_SCHEMA_CODES.has(error.code);
}

/**
 * 22P02 invalid_text_representation: an enum label the database does not
 * know yet (e.g. filtering goal_type = 'strength' before its migration ran).
 */
export function isUnknownEnumValueError(error: DbError): boolean {
  return error?.code === '22P02';
}

/**
 * Caches one probe per key for the app run. A probe that fails for another
 * reason (offline) is not cached, so the next call asks again.
 * `isMissing` decides which errors mean "not there" (default: missing column/table).
 */
export function createSchemaProbe(
  probe: () => PromiseLike<{ error: DbError }>,
  isMissing: (error: DbError) => boolean = isMissingSchemaError,
): () => Promise<boolean> {
  let known: boolean | null = null;
  return async () => {
    if (known != null) {
      return known;
    }
    const { error } = await probe();
    if (!error) {
      known = true;
      return true;
    }
    if (isMissing(error)) {
      known = false;
      return false;
    }
    return false;
  };
}
