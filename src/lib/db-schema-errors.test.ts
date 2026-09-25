import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSchemaProbe, isMissingSchemaError } from './db-schema-errors.ts';

describe('isMissingSchemaError', () => {
  it('recognises missing columns, tables and functions', () => {
    for (const code of ['42703', '42P01', 'PGRST204', 'PGRST205', 'PGRST202']) {
      assert.equal(isMissingSchemaError({ code, message: '' }), true, code);
    }
  });

  it('leaves other errors alone', () => {
    assert.equal(isMissingSchemaError({ code: '42501', message: 'rls' }), false);
    assert.equal(isMissingSchemaError(null), false);
  });
});

describe('createSchemaProbe', () => {
  it('caches a present column', async () => {
    let calls = 0;
    const probe = createSchemaProbe(async () => {
      calls += 1;
      return { error: null };
    });
    assert.equal(await probe(), true);
    assert.equal(await probe(), true);
    assert.equal(calls, 1);
  });

  it('caches a missing column', async () => {
    let calls = 0;
    const probe = createSchemaProbe(async () => {
      calls += 1;
      return { error: { code: '42703', message: 'column does not exist' } };
    });
    assert.equal(await probe(), false);
    assert.equal(await probe(), false);
    assert.equal(calls, 1);
  });

  it('asks again after a network error', async () => {
    let calls = 0;
    const probe = createSchemaProbe(async () => {
      calls += 1;
      return calls === 1 ? { error: { code: 'fetch', message: 'offline' } } : { error: null };
    });
    assert.equal(await probe(), false);
    assert.equal(await probe(), true);
    assert.equal(calls, 2);
  });
});
