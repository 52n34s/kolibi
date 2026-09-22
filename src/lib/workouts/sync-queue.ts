import { newId } from '../id';
import type { StringKvStorage } from './kv-storage';
import type { GymIntensity, UnitColorKey } from './types';

export type SyncStatus = 'synced' | 'pending' | 'offline';

export type UpsertSessionOpPayload = {
  id: string;
  templateId: string | null;
  templateName: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  loggedOn: string;
  startedAt: string;
  finishedAt?: string | null;
  intensity?: GymIntensity | null;
  trainingSessionId?: string | null;
};

export type SyncSetUpsertPayload = {
  id: string;
  sessionId: string;
  exerciseId?: string | null;
  exerciseName: string;
  exercisePosition: number;
  setIndex: number;
  kind: 'reps' | 'weighted' | 'time';
  perSide?: boolean;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetSeconds?: number | null;
  targetSecondsMax?: number | null;
  targetWeightKg?: number | null;
  reps?: number | null;
  seconds?: number | null;
  secondsOtherSide?: number | null;
  weightKg?: number | null;
  completedAt?: string;
};

export type SyncQueueOp =
  | {
      id: string;
      type: 'upsertSession';
      payload: UpsertSessionOpPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: 'upsertSets';
      payload: SyncSetUpsertPayload[];
      createdAt: string;
    }
  | {
      id: string;
      type: 'deleteSet';
      payload: { setId: string };
      createdAt: string;
    }
  | {
      id: string;
      type: 'deleteSession';
      payload: { sessionId: string };
      createdAt: string;
    };

export type SyncQueueApi = {
  upsertWorkoutSession: (input: UpsertSessionOpPayload) => Promise<unknown>;
  upsertSessionSets: (sets: SyncSetUpsertPayload[]) => Promise<unknown>;
  deleteSessionSet: (setId: string) => Promise<void>;
  deleteWorkoutSession: (sessionId: string) => Promise<void>;
};

/**
 * Error sink for this pure module. `sync-queue-runtime.ts` wires it to Sentry;
 * Node tests leave the no-op in place so nothing native gets imported here.
 */
let reportError: (error: unknown) => void = () => {};

export function setSyncQueueErrorReporter(report: (error: unknown) => void): void {
  reportError = report;
}

export const WORKOUT_SYNC_QUEUE_KEY = 'workout-sync-queue-v1';
const STATUS_KEY = 'workout-sync-queue-status-v1';

type StatusListener = () => void;

function readOps(storage: StringKvStorage): SyncQueueOp[] {
  const raw = storage.getString(WORKOUT_SYNC_QUEUE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SyncQueueOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // A corrupt queue silently drops pending writes — always report it.
    reportError(error);
    return [];
  }
}

function writeOps(storage: StringKvStorage, ops: SyncQueueOp[]): void {
  if (ops.length === 0) {
    storage.remove(WORKOUT_SYNC_QUEUE_KEY);
    return;
  }
  storage.set(WORKOUT_SYNC_QUEUE_KEY, JSON.stringify(ops));
}

function readStatus(storage: StringKvStorage): SyncStatus {
  const raw = storage.getString(STATUS_KEY);
  if (raw === 'synced' || raw === 'pending' || raw === 'offline') {
    return raw;
  }
  return 'synced';
}

function writeStatus(storage: StringKvStorage, status: SyncStatus): void {
  storage.set(STATUS_KEY, status);
}

function newOpId(): string {
  return newId();
}

/**
 * Collapse queue so later ops win:
 * - upsertSession by session id
 * - upsertSets by set id (latest wins)
 * - deleteSet drops prior upserts for that set id
 * - deleteSession drops prior upserts/deletes for that session
 */
export function coalesceOps(ops: SyncQueueOp[]): SyncQueueOp[] {
  const sessionUpserts = new Map<string, SyncQueueOp & { type: 'upsertSession' }>();
  const setById = new Map<string, SyncSetUpsertPayload>();
  let setsOpMeta: { id: string; createdAt: string } | null = null;
  const deleteSets = new Map<string, SyncQueueOp & { type: 'deleteSet' }>();
  const deleteSessions = new Map<string, SyncQueueOp & { type: 'deleteSession' }>();

  for (const op of ops) {
    if (op.type === 'upsertSession') {
      deleteSessions.delete(op.payload.id);
      sessionUpserts.set(op.payload.id, op);
      continue;
    }
    if (op.type === 'deleteSession') {
      const sessionId = op.payload.sessionId;
      sessionUpserts.delete(sessionId);
      for (const [setId, set] of [...setById.entries()]) {
        if (set.sessionId === sessionId) {
          setById.delete(setId);
          deleteSets.delete(setId);
        }
      }
      deleteSessions.set(sessionId, op);
      continue;
    }
    if (op.type === 'deleteSet') {
      setById.delete(op.payload.setId);
      deleteSets.set(op.payload.setId, op);
      continue;
    }
    // upsertSets
    for (const set of op.payload) {
      deleteSessions.delete(set.sessionId);
      deleteSets.delete(set.id);
      setById.set(set.id, set);
    }
    setsOpMeta = { id: op.id, createdAt: op.createdAt };
  }

  const out: SyncQueueOp[] = [];
  for (const op of sessionUpserts.values()) {
    out.push(op);
  }
  if (setById.size > 0) {
    out.push({
      id: setsOpMeta?.id ?? newOpId(),
      type: 'upsertSets',
      payload: [...setById.values()],
      createdAt: setsOpMeta?.createdAt ?? new Date().toISOString(),
    });
  }
  for (const op of deleteSets.values()) {
    out.push(op);
  }
  for (const op of deleteSessions.values()) {
    out.push(op);
  }
  return out;
}

export function createWorkoutSyncQueue(storage: StringKvStorage, api: SyncQueueApi) {
  let flushing = false;
  const listeners = new Set<StatusListener>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setStatus(status: SyncStatus): void {
    writeStatus(storage, status);
    notify();
  }

  function enqueue(
    op: Omit<SyncQueueOp, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): void {
    const full = {
      ...op,
      id: op.id ?? newOpId(),
      createdAt: op.createdAt ?? new Date().toISOString(),
    } as SyncQueueOp;
    const next = coalesceOps([...readOps(storage), full]);
    writeOps(storage, next);
    setStatus(next.length === 0 ? 'synced' : 'pending');
  }

  function getStatus(): SyncStatus {
    const ops = readOps(storage);
    if (ops.length === 0) {
      const stored = readStatus(storage);
      return stored === 'offline' ? 'offline' : 'synced';
    }
    return readStatus(storage) === 'offline' ? 'offline' : 'pending';
  }

  function peek(): SyncQueueOp[] {
    return readOps(storage);
  }

  function subscribe(listener: StatusListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  async function flush(): Promise<void> {
    if (flushing) {
      return;
    }
    flushing = true;
    try {
      let ops = coalesceOps(readOps(storage));
      writeOps(storage, ops);

      while (ops.length > 0) {
        const head = ops[0];
        if (!head) {
          break;
        }
        try {
          if (head.type === 'upsertSession') {
            await api.upsertWorkoutSession(head.payload);
          } else if (head.type === 'upsertSets') {
            await api.upsertSessionSets(head.payload);
          } else if (head.type === 'deleteSet') {
            await api.deleteSessionSet(head.payload.setId);
          } else {
            await api.deleteWorkoutSession(head.payload.sessionId);
          }
          ops = ops.slice(1);
          writeOps(storage, ops);
          notify();
        } catch (error) {
          setStatus('offline');
          throw error;
        }
      }
      setStatus('synced');
    } finally {
      flushing = false;
    }
  }

  return {
    enqueue,
    flush,
    getStatus,
    peek,
    subscribe,
    enqueueUpsertSession(payload: UpsertSessionOpPayload) {
      enqueue({ type: 'upsertSession', payload });
    },
    enqueueUpsertSets(payload: SyncSetUpsertPayload[]) {
      if (payload.length === 0) {
        return;
      }
      enqueue({ type: 'upsertSets', payload });
    },
    enqueueDeleteSet(setId: string) {
      enqueue({ type: 'deleteSet', payload: { setId } });
    },
    enqueueDeleteSession(sessionId: string) {
      enqueue({ type: 'deleteSession', payload: { sessionId } });
    },
  };
}

export type WorkoutSyncQueue = ReturnType<typeof createWorkoutSyncQueue>;
