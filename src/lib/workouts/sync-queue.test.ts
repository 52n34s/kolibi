import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryKvStorage } from './kv-storage.ts';
import {
  coalesceOps,
  createWorkoutSyncQueue,
  type SyncQueueApi,
  type SyncQueueOp,
} from './sync-queue.ts';

function sessionOp(id: string, name = 'A'): SyncQueueOp {
  return {
    id: `op-session-${id}-${name}`,
    type: 'upsertSession',
    createdAt: '2026-09-22T10:00:00.000Z',
    payload: {
      id,
      templateId: 't1',
      templateName: name,
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    },
  };
}

function setOp(setId: string, sessionId: string, reps: number): SyncQueueOp {
  return {
    id: `op-set-${setId}-${reps}`,
    type: 'upsertSets',
    createdAt: '2026-09-22T10:00:00.000Z',
    payload: [
      {
        id: setId,
        sessionId,
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps,
      },
    ],
  };
}

describe('coalesceOps', () => {
  it('keeps the latest upsertSession per id', () => {
    const out = coalesceOps([sessionOp('s1', 'old'), sessionOp('s1', 'new')]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, 'upsertSession');
    if (out[0]?.type === 'upsertSession') {
      assert.equal(out[0].payload.templateName, 'new');
    }
  });

  it('merges upsertSets by set id (latest wins)', () => {
    const out = coalesceOps([setOp('set1', 's1', 8), setOp('set1', 's1', 10)]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, 'upsertSets');
    if (out[0]?.type === 'upsertSets') {
      assert.equal(out[0].payload.length, 1);
      assert.equal(out[0].payload[0]?.reps, 10);
    }
  });

  it('deleteSet drops a prior upsert for that set', () => {
    const out = coalesceOps([
      setOp('set1', 's1', 8),
      {
        id: 'del-set',
        type: 'deleteSet',
        createdAt: '2026-09-22T10:01:00.000Z',
        payload: { setId: 'set1' },
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, 'deleteSet');
  });

  it('deleteSession drops prior upserts for that session', () => {
    const out = coalesceOps([
      sessionOp('s1'),
      setOp('set1', 's1', 8),
      {
        id: 'del',
        type: 'deleteSession',
        createdAt: '2026-09-22T10:01:00.000Z',
        payload: { sessionId: 's1' },
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, 'deleteSession');
  });
});

describe('createWorkoutSyncQueue', () => {
  it('flushes duplicate enqueues as a single upsert call and preserves order', async () => {
    const storage = createMemoryKvStorage();
    const calls: string[] = [];
    const api: SyncQueueApi = {
      upsertWorkoutSession: async (input) => {
        calls.push(`session:${input.id}:${input.templateName}`);
      },
      upsertSessionSets: async (sets) => {
        calls.push(`sets:${sets.map((s) => `${s.id}:${s.reps}`).join(',')}`);
      },
      deleteSessionSet: async (setId) => {
        calls.push(`deleteSet:${setId}`);
      },
      deleteWorkoutSession: async (sessionId) => {
        calls.push(`delete:${sessionId}`);
      },
    };

    const queue = createWorkoutSyncQueue(storage, api);
    queue.enqueueUpsertSession({
      id: 's1',
      templateId: 't1',
      templateName: 'v1',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    queue.enqueueUpsertSession({
      id: 's1',
      templateId: 't1',
      templateName: 'v2',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    queue.enqueueUpsertSets([
      {
        id: 'set1',
        sessionId: 's1',
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps: 8,
      },
    ]);
    queue.enqueueUpsertSets([
      {
        id: 'set1',
        sessionId: 's1',
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps: 10,
      },
    ]);

    assert.equal(queue.getStatus(), 'pending');
    await queue.flush();
    assert.deepEqual(calls, ['session:s1:v2', 'sets:set1:10']);
    assert.equal(queue.getStatus(), 'synced');
    assert.equal(queue.peek().length, 0);
  });

  it('stops on error, keeps the op, and marks offline', async () => {
    const storage = createMemoryKvStorage();
    const api: SyncQueueApi = {
      upsertWorkoutSession: async () => {
        throw new Error('network');
      },
      upsertSessionSets: async () => {},
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async () => {},
    };
    const queue = createWorkoutSyncQueue(storage, api);
    queue.enqueueUpsertSession({
      id: 's1',
      templateId: null,
      templateName: 'A',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    await assert.rejects(() => queue.flush(), /network/);
    assert.equal(queue.getStatus(), 'offline');
    assert.equal(queue.peek().length, 1);
  });
});
