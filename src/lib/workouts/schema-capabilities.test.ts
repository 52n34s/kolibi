import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCapabilityCache,
  isMissingColumnError,
  withOptionalColumn,
  type SchemaCapability,
} from './schema-capabilities.ts';
import { normalizeRir, toSessionSetRow, type SessionSetRowInput } from './session-set-row.ts';

function probeReturning(...results: { error: unknown }[]) {
  const calls: SchemaCapability[] = [];
  const probe = async (capability: SchemaCapability) => {
    calls.push(capability);
    const next = results.shift();
    if (!next) {
      throw new Error('unexpected probe');
    }
    return next;
  };
  return { probe, calls };
}

describe('isMissingColumnError', () => {
  it('PGRST204 and 42703 mean the column is missing', () => {
    assert.equal(isMissingColumnError({ code: 'PGRST204' }), true);
    assert.equal(isMissingColumnError({ code: '42703' }), true);
  });

  it('anything else is not a missing column', () => {
    assert.equal(isMissingColumnError({ code: 'PGRST301' }), false);
    assert.equal(isMissingColumnError(new Error('Network request failed')), false);
    assert.equal(isMissingColumnError(null), false);
  });
});

describe('createCapabilityCache', () => {
  it('available once the probe succeeds, probed once per run', async () => {
    const { probe, calls } = probeReturning({ error: null });
    const cache = createCapabilityCache(probe);
    assert.equal(cache.known('sessionSetsRir'), false);
    assert.equal(await cache.check('sessionSetsRir'), true);
    assert.equal(await cache.check('sessionSetsRir'), true);
    assert.equal(cache.known('sessionSetsRir'), true);
    assert.deepEqual(calls, ['sessionSetsRir']);
  });

  it('missing column is cached as unavailable', async () => {
    const { probe, calls } = probeReturning({ error: { code: '42703' } });
    const cache = createCapabilityCache(probe);
    assert.equal(await cache.check('workoutSessionsShortfallReasons'), false);
    assert.equal(await cache.check('workoutSessionsShortfallReasons'), false);
    assert.equal(calls.length, 1);
  });

  it('other errors reject, are not cached, and checkOrFalse treats them as unavailable', async () => {
    const { probe, calls } = probeReturning(
      { error: { code: 'FETCH', message: 'offline' } },
      { error: { code: 'FETCH', message: 'offline' } },
      { error: null },
    );
    const cache = createCapabilityCache(probe);
    await assert.rejects(cache.check('sessionSetsRir'));
    assert.equal(await cache.checkOrFalse('sessionSetsRir'), false);
    assert.equal(await cache.check('sessionSetsRir'), true);
    assert.equal(calls.length, 3);
  });

  it('parallel checks share one probe', async () => {
    const { probe, calls } = probeReturning({ error: null });
    const cache = createCapabilityCache(probe);
    const [a, b] = await Promise.all([cache.check('sessionSetsRir'), cache.check('sessionSetsRir')]);
    assert.equal(a && b, true);
    assert.equal(calls.length, 1);
  });
});

describe('withOptionalColumn', () => {
  it('drops the key unless available', () => {
    assert.deepEqual(withOptionalColumn({ a: 1, b: 2 }, 'b', false), { a: 1 });
    assert.deepEqual(withOptionalColumn({ a: 1, b: 2 }, 'b', true), { a: 1, b: 2 });
    assert.deepEqual(withOptionalColumn({ a: 1 }, 'b', false), { a: 1 });
  });
});

describe('toSessionSetRow', () => {
  const base: SessionSetRowInput = {
    id: 'set1',
    sessionId: 'sess1',
    userId: 'u1',
    exerciseId: 'ex1',
    exerciseName: 'Push-up',
    exercisePosition: 0,
    setIndex: 0,
    kind: 'reps',
    reps: 10,
    rir: 2,
    completedAt: '2026-09-25T10:00:00.000Z',
  };

  it('without the column: no rir key at all (no PGRST204)', () => {
    const row = toSessionSetRow(base, { withRir: false });
    assert.equal('rir' in row, false);
    assert.equal(row.reps, 10);
  });

  it('with the column: rir is written', () => {
    assert.equal(toSessionSetRow(base, { withRir: true }).rir, 2);
    assert.equal(toSessionSetRow({ ...base, rir: undefined }, { withRir: true }).rir, null);
  });

  it('time sets never carry rir', () => {
    const row = toSessionSetRow({ ...base, kind: 'time', reps: null, seconds: 30 }, { withRir: true });
    assert.equal(row.rir, null);
  });

  it('normalizeRir keeps 0–3 integers only', () => {
    assert.equal(normalizeRir(0), 0);
    assert.equal(normalizeRir(3), 3);
    assert.equal(normalizeRir(4), null);
    assert.equal(normalizeRir(1.5), null);
    assert.equal(normalizeRir('2'), null);
  });
});
