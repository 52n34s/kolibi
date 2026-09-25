/**
 * Saving the Expo push token for the signed-in user.
 *
 * The preferred path is the register_push_token RPC (SECURITY DEFINER): it
 * moves a token that still belongs to another account, for example the
 * anonymous one this device used before sign-in, to the current user. Until
 * that migration runs, the direct delete/upsert path is the fallback. There RLS
 * rejects a token owned by someone else, and that error is now reported
 * instead of being treated as success.
 */

export type PushTokenInput = {
  userId: string;
  token: string;
  platform: string;
  deviceId: string | null;
};

export type PushTokenDbError = {
  code?: string;
  message: string;
};

export type PushTokenBackend = {
  registerViaRpc(input: PushTokenInput): Promise<{ error: PushTokenDbError | null }>;
  /** Direct table writes; rowCount is the number of rows the upsert returned. */
  upsertDirect(
    input: PushTokenInput,
  ): Promise<{ error: PushTokenDbError | null; rowCount: number | null }>;
};

export type PushTokenFailureReason =
  | 'token_owned_by_other_user'
  | 'no_row_written'
  | 'rpc_failed'
  | 'upsert_failed';

export type PushTokenSaveResult =
  | { ok: true; via: 'rpc' | 'direct' }
  | { ok: false; via: 'rpc' | 'direct'; reason: PushTokenFailureReason; error: PushTokenDbError | null };

/** PostgREST answers PGRST202 when the function is not in the schema cache; Postgres 42883. */
export function isMissingRpcError(error: PushTokenDbError | null): boolean {
  if (!error) {
    return false;
  }
  return error.code === 'PGRST202' || error.code === '42883';
}

/** 42501: row-level security refused the write (token row owned by another user). */
export function isRlsViolation(error: PushTokenDbError | null): boolean {
  return error?.code === '42501';
}

export async function savePushToken(
  backend: PushTokenBackend,
  input: PushTokenInput,
): Promise<PushTokenSaveResult> {
  const rpc = await backend.registerViaRpc(input);
  if (!rpc.error) {
    return { ok: true, via: 'rpc' };
  }
  if (!isMissingRpcError(rpc.error)) {
    return { ok: false, via: 'rpc', reason: 'rpc_failed', error: rpc.error };
  }

  const direct = await backend.upsertDirect(input);
  if (direct.error) {
    return {
      ok: false,
      via: 'direct',
      reason: isRlsViolation(direct.error) ? 'token_owned_by_other_user' : 'upsert_failed',
      error: direct.error,
    };
  }
  if (direct.rowCount === 0) {
    return { ok: false, via: 'direct', reason: 'no_row_written', error: null };
  }
  return { ok: true, via: 'direct' };
}
