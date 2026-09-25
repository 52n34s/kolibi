/**
 * Optional columns the app may write only once their migration ran.
 *
 * Sending an unknown column makes PostgREST reject the whole row (PGRST204),
 * which would stall every queued set. So each column is probed once per app
 * run and only written when the probe saw it.
 */

export type SchemaCapability = 'sessionSetsRir' | 'workoutSessionsShortfallReasons';

export const SCHEMA_CAPABILITY_COLUMNS: Record<SchemaCapability, { table: string; column: string }> = {
  sessionSetsRir: { table: 'session_sets', column: 'rir' },
  workoutSessionsShortfallReasons: { table: 'workout_sessions', column: 'shortfall_reasons' },
};

/** PostgREST schema-cache miss (PGRST204) or Postgres undefined_column (42703). */
export function isMissingColumnError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === 'PGRST204' || code === '42703';
}

/** Runs `select <column> from <table> limit 0`; resolves with the PostgREST error, if any. */
export type CapabilityProbe = (capability: SchemaCapability) => Promise<{ error: unknown }>;

export type CapabilityCache = {
  /**
   * true / false once known. Rejects on any other probe error (offline, …),
   * which is not cached — the next call probes again.
   */
  check: (capability: SchemaCapability) => Promise<boolean>;
  /** Cached answer without probing; false while unknown. */
  known: (capability: SchemaCapability) => boolean;
  /** Same as check, but any failure counts as "not available". */
  checkOrFalse: (capability: SchemaCapability) => Promise<boolean>;
};

export function createCapabilityCache(probe: CapabilityProbe): CapabilityCache {
  const results = new Map<SchemaCapability, boolean>();
  const inflight = new Map<SchemaCapability, Promise<boolean>>();

  function check(capability: SchemaCapability): Promise<boolean> {
    const cached = results.get(capability);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    const running = inflight.get(capability);
    if (running) {
      return running;
    }
    const next = probe(capability)
      .then(({ error }) => {
        if (error == null) {
          results.set(capability, true);
          return true;
        }
        if (isMissingColumnError(error)) {
          results.set(capability, false);
          return false;
        }
        throw error;
      })
      .finally(() => {
        inflight.delete(capability);
      });
    inflight.set(capability, next);
    return next;
  }

  return {
    check,
    known: (capability) => results.get(capability) === true,
    checkOrFalse: (capability) => check(capability).catch(() => false),
  };
}

/** Drop `key` from a row unless the capability is available. */
export function withOptionalColumn<T extends Record<string, unknown>>(
  row: T,
  key: string,
  available: boolean,
): T {
  if (available || !(key in row)) {
    return row;
  }
  const { [key]: _dropped, ...rest } = row;
  return rest as T;
}
