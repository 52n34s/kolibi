import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryKvStorage } from './kv-storage.ts';
import {
  coalesceOps,
  createWorkoutSyncQueue,
  partitionByOwner,
  setSyncQueueDropReporter,
  type SyncQueueApi,
  type SyncQueueOp,
} from './sync-queue.ts';

const USER = 'user-a';

function sessionOp(id: string, name = 'A', userId = USER): SyncQueueOp {
  return {
    id: `op-session-${id}-${name}`,
    type: 'upsertSession',
    userId,
    createdAt: '2026-09-22T10:00:00.000Z',
    payload: {
      id,
      userId,
      templateId: 't1',
      templateName: name,
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    },
  };
}

function setOp(
  setId: string,
  sessionId: string,
  reps: number,
  userId = USER,
): SyncQueueOp {
  return {
    id: `op-set-${setId}-${reps}`,
    type: 'upsertSets',
    userId,
    createdAt: '2026-09-22T10:00:00.000Z',
    payload: [
      {
        id: setId,
        sessionId,
        userId,
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
        userId: USER,
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
        userId: USER,
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

    const queue = createWorkoutSyncQueue(storage, api, () => USER);
    queue.enqueueUpsertSession({
      id: 's1',
      userId: USER,
      templateId: 't1',
      templateName: 'v1',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    queue.enqueueUpsertSession({
      id: 's1',
      userId: USER,
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
        userId: USER,
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
        userId: USER,
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
    const queue = createWorkoutSyncQueue(storage, api, () => USER);
    queue.enqueueUpsertSession({
      id: 's1',
      userId: USER,
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


describe('flush while a request is running', () => {
  function sessionPayload(id: string, templateName: string) {
    return {
      id,
      userId: USER,
      templateId: null,
      templateName,
      shortLabel: 'A',
      colorKey: 'indigo' as const,
      loggedOn: '2026-09-25',
      startedAt: '2026-09-25T17:00:00.000Z',
    };
  }

  it('keeps an op enqueued during a request and a second flush waits until it is sent', async () => {
    const storage = createMemoryKvStorage();
    const calls: string[] = [];
    let releaseFirst: () => void = () => {};
    const api: SyncQueueApi = {
      upsertWorkoutSession: async (input) => {
        calls.push(`session:${input.id}:${input.templateName}`);
        if (calls.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
      },
      upsertSessionSets: async (sets) => {
        calls.push(`sets:${sets.map((s) => s.id).join(',')}`);
      },
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async () => {},
    };
    const queue = createWorkoutSyncQueue(storage, api, () => USER);
    queue.enqueueUpsertSession(sessionPayload('s1', 'start'));
    const background = queue.flush();
    await new Promise((resolve) => setImmediate(resolve));

    // Finish while the background flush waits on the network.
    queue.enqueueUpsertSession(sessionPayload('s1', 'finished'));
    queue.enqueueUpsertSets([
      {
        id: 'last-set',
        sessionId: 's1',
        userId: USER,
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps: 8,
      },
    ]);
    const finishFlush = queue.flush();
    releaseFirst();
    await Promise.all([background, finishFlush]);

    assert.deepEqual(calls, ['session:s1:start', 'session:s1:finished', 'sets:last-set']);
    assert.equal(queue.peek().length, 0);
    assert.equal(queue.getStatus(), 'synced');
  });

  it('a delete carries the unlinked training session of a failed finish', async () => {
    const storage = createMemoryKvStorage();
    const deletes: [string, string | null | undefined][] = [];
    const api: SyncQueueApi = {
      upsertWorkoutSession: async () => {},
      upsertSessionSets: async () => {},
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async (sessionId, trainingSessionId) => {
        deletes.push([sessionId, trainingSessionId]);
      },
    };
    const queue = createWorkoutSyncQueue(storage, api, () => USER);
    queue.enqueueUpsertSession(sessionPayload('s1', 'finished'));
    queue.enqueueDeleteSession('s1', USER, 'ts-1');
    queue.enqueueDeleteSession('s2', USER);
    await queue.flush();
    assert.deepEqual(deletes, [
      ['s1', 'ts-1'],
      ['s2', null],
    ]);
  });
});

describe('account isolation', () => {
  it('splits queued ops by owner', () => {
    const ops = [sessionOp('s1', 'A', 'user-a'), sessionOp('s2', 'B', 'user-b')];
    const { mine, foreign } = partitionByOwner(ops, 'user-a');
    assert.equal(mine.length, 1);
    assert.equal(foreign.length, 1);
    assert.equal(mine[0]?.userId, 'user-a');
    assert.equal(foreign[0]?.userId, 'user-b');
  });

  it('drops ops from a previous account instead of sending them', async () => {
    const storage = createMemoryKvStorage();
    const sent: string[] = [];
    const api: SyncQueueApi = {
      upsertWorkoutSession: async (input) => {
        sent.push(`session:${input.id}:${input.userId}`);
      },
      upsertSessionSets: async (sets) => {
        for (const set of sets) {
          sent.push(`set:${set.id}:${set.userId}`);
        }
      },
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async () => {},
    };

    const dropped: { count: number; ownerIds: string[] }[] = [];
    setSyncQueueDropReporter((report) => {
      dropped.push({ count: report.count, ownerIds: report.ownerIds });
    });

    // Queue belongs to user-a, but user-b is signed in now.
    const queue = createWorkoutSyncQueue(storage, api, () => 'user-b');
    queue.enqueueUpsertSession({
      id: 's1',
      userId: 'user-a',
      templateId: null,
      templateName: 'A',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    queue.enqueueUpsertSets([
      {
        id: 'set1',
        sessionId: 's1',
        userId: 'user-a',
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps: 8,
      },
    ]);

    await queue.flush();

    assert.deepEqual(sent, [], 'nothing from the old account may reach the API');
    assert.equal(queue.peek().length, 0, 'foreign ops are removed, not kept');
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0]?.count, 2);
    assert.deepEqual(dropped[0]?.ownerIds, ['user-a']);

    setSyncQueueDropReporter(() => {});
  });

  it('keeps the queue untouched while nobody is signed in', async () => {
    const storage = createMemoryKvStorage();
    const sent: string[] = [];
    const api: SyncQueueApi = {
      upsertWorkoutSession: async (input) => {
        sent.push(input.id);
      },
      upsertSessionSets: async () => {},
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async () => {},
    };
    const queue = createWorkoutSyncQueue(storage, api, () => null);
    queue.enqueueUpsertSession({
      id: 's1',
      userId: 'user-a',
      templateId: null,
      templateName: 'A',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });

    await queue.flush();

    assert.deepEqual(sent, []);
    assert.equal(queue.peek().length, 1, 'a transient auth gap must not lose work');
  });

  it('sends the user_id carried by the operation, not the signed-in one', async () => {
    const storage = createMemoryKvStorage();
    const sent: string[] = [];
    const api: SyncQueueApi = {
      upsertWorkoutSession: async (input) => {
        sent.push(`session:${input.userId}`);
      },
      upsertSessionSets: async (sets) => {
        for (const set of sets) {
          sent.push(`set:${set.userId}`);
        }
      },
      deleteSessionSet: async () => {},
      deleteWorkoutSession: async () => {},
    };
    const queue = createWorkoutSyncQueue(storage, api, () => USER);
    queue.enqueueUpsertSession({
      id: 's1',
      userId: USER,
      templateId: null,
      templateName: 'A',
      shortLabel: 'A',
      colorKey: 'indigo',
      loggedOn: '2026-09-22',
      startedAt: '2026-09-22T09:00:00.000Z',
    });
    queue.enqueueUpsertSets([
      {
        id: 'set1',
        sessionId: 's1',
        userId: USER,
        exerciseName: 'Push-up',
        exercisePosition: 0,
        setIndex: 0,
        kind: 'reps',
        reps: 8,
      },
    ]);

    await queue.flush();
    assert.deepEqual(sent, [`session:${USER}`, `set:${USER}`]);
  });

  it('never merges two owners into one upsertSets op', () => {
    const out = coalesceOps([
      setOp('set1', 's1', 8, 'user-a'),
      setOp('set2', 's2', 9, 'user-b'),
    ]);
    const setOps = out.filter((op) => op.type === 'upsertSets');
    assert.equal(setOps.length, 2);
    for (const op of setOps) {
      if (op.type !== 'upsertSets') {
        continue;
      }
      const owners = new Set(op.payload.map((row) => row.userId));
      assert.equal(owners.size, 1);
      assert.equal([...owners][0], op.userId);
    }
  });
});
