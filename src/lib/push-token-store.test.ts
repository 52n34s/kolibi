import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  savePushToken,
  type PushTokenBackend,
  type PushTokenDbError,
  type PushTokenInput,
} from './push-token-store.ts';

const input: PushTokenInput = {
  userId: 'account-user',
  token: 'ExponentPushToken[device-a]',
  platform: 'ios',
  deviceId: 'vendor-a',
};

const RPC_MISSING: PushTokenDbError = {
  code: 'PGRST202',
  message: 'Could not find the function public.register_push_token in the schema cache',
};

const RLS_DENIED: PushTokenDbError = {
  code: '42501',
  message: 'new row violates row-level security policy for table "push_tokens"',
};

function backend(options: {
  rpc: PushTokenDbError | null;
  direct?: { error: PushTokenDbError | null; rowCount: number | null };
}) {
  const calls = { rpc: [] as PushTokenInput[], direct: [] as PushTokenInput[] };
  const api: PushTokenBackend = {
    async registerViaRpc(value) {
      calls.rpc.push(value);
      return { error: options.rpc };
    },
    async upsertDirect(value) {
      calls.direct.push(value);
      return options.direct ?? { error: null, rowCount: 1 };
    },
  };
  return { api, calls };
}

describe('savePushToken', () => {
  // Device token still belongs to the anonymous account from before sign-in:
  // the RPC moves it, so the direct path is never touched.
  it('takes over a token of another user through the RPC', async () => {
    const { api, calls } = backend({ rpc: null });
    assert.deepEqual(await savePushToken(api, input), { ok: true, via: 'rpc' });
    assert.deepEqual(calls.rpc, [input]);
    assert.equal(calls.direct.length, 0);
  });

  it('falls back to the direct upsert while the migration has not run', async () => {
    const { api, calls } = backend({ rpc: RPC_MISSING });
    assert.deepEqual(await savePushToken(api, input), { ok: true, via: 'direct' });
    assert.equal(calls.direct.length, 1);
  });

  // The bug: RLS refused the upsert and the app still reported success.
  it('reports a token owned by another user on the fallback path', async () => {
    const { api } = backend({ rpc: RPC_MISSING, direct: { error: RLS_DENIED, rowCount: null } });
    assert.deepEqual(await savePushToken(api, input), {
      ok: false,
      via: 'direct',
      reason: 'token_owned_by_other_user',
      error: RLS_DENIED,
    });
  });

  it('reports an upsert that wrote no row', async () => {
    const { api } = backend({ rpc: RPC_MISSING, direct: { error: null, rowCount: 0 } });
    const result = await savePushToken(api, input);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'no_row_written');
  });

  it('reports other upsert errors', async () => {
    const error = { code: '23502', message: 'null value in column' };
    const { api } = backend({ rpc: RPC_MISSING, direct: { error, rowCount: null } });
    const result = await savePushToken(api, input);
    assert.equal(result.ok === false && result.reason, 'upsert_failed');
  });

  it('does not fall back when the RPC exists and fails', async () => {
    const error = { code: '08006', message: 'connection failure' };
    const { api, calls } = backend({ rpc: error });
    const result = await savePushToken(api, input);
    assert.equal(result.ok === false && result.reason, 'rpc_failed');
    assert.equal(calls.direct.length, 0);
  });
});
