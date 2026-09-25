import * as Sentry from '@sentry/react-native';
import { useSyncExternalStore } from 'react';
import type { NativeEventSubscription } from 'react-native';

import { getMmkv } from '@/lib/mmkv-zustand-storage';
import {
  createWorkoutSyncQueue,
  setSyncQueueDropReporter,
  setSyncQueueErrorReporter,
  type SyncStatus,
  type WorkoutSyncQueue,
} from './sync-queue';

setSyncQueueErrorReporter((error) => {
  Sentry.captureException(error);
});

setSyncQueueDropReporter((dropped) => {
  // Breadcrumb, not an exception: dropping is the correct outcome after an
  // account switch, but we want to see when and how often it happens.
  Sentry.addBreadcrumb({
    category: 'workout-sync',
    level: 'warning',
    message: 'dropped queue ops from a previous account',
    data: dropped,
  });
});

/** Read lazily: auth-store imports the queue, so a top-level import loops. */
function currentUserId(): string | null {
  try {
    const store = require('@/stores/auth-store') as typeof import('@/stores/auth-store');
    return store.useAuthStore.getState().session?.user?.id ?? null;
  } catch {
    return null;
  }
}

const TRAINING_MMKV_ID = 'training';

let singleton: WorkoutSyncQueue | null = null;
let appStateSub: NativeEventSubscription | null = null;

function defaultStorage() {
  const mmkv = getMmkv(TRAINING_MMKV_ID);
  return {
    getString: (key: string) => mmkv.getString(key),
    set: (key: string, value: string) => {
      mmkv.set(key, value);
    },
    remove: (key: string) => {
      mmkv.remove(key);
    },
  };
}

function defaultApi() {
  const api = require('./workouts-api') as typeof import('./workouts-api');
  return {
    upsertWorkoutSession: api.upsertWorkoutSession,
    upsertSessionSets: api.upsertSessionSets,
    deleteSessionSet: api.deleteSessionSet,
    deleteWorkoutSession: api.deleteWorkoutSession,
  };
}

export function getWorkoutSyncQueue(): WorkoutSyncQueue {
  if (!singleton) {
    singleton = createWorkoutSyncQueue(defaultStorage(), defaultApi(), currentUserId);
  }
  return singleton;
}

/** Test helper — replaces the process-wide queue singleton. */
export function __setWorkoutSyncQueueForTests(queue: WorkoutSyncQueue | null): void {
  singleton = queue;
}

export function enqueueUpsertSession(
  payload: Parameters<WorkoutSyncQueue['enqueueUpsertSession']>[0],
): void {
  getWorkoutSyncQueue().enqueueUpsertSession(payload);
}

export function enqueueUpsertSets(
  payload: Parameters<WorkoutSyncQueue['enqueueUpsertSets']>[0],
): void {
  getWorkoutSyncQueue().enqueueUpsertSets(payload);
}

export function enqueueDeleteSet(setId: string, userId: string): void {
  getWorkoutSyncQueue().enqueueDeleteSet(setId, userId);
}

export function enqueueDeleteSession(
  sessionId: string,
  userId: string,
  trainingSessionId?: string | null,
): void {
  getWorkoutSyncQueue().enqueueDeleteSession(sessionId, userId, trainingSessionId);
}

/** Drop every queued op, e.g. on sign-out. */
export function clearWorkoutSyncQueue(): void {
  getWorkoutSyncQueue().clear();
}

export async function flushWorkoutSyncQueue(): Promise<void> {
  await getWorkoutSyncQueue().flush();
}

export function getWorkoutSyncStatus(): SyncStatus {
  return getWorkoutSyncQueue().getStatus();
}

export function useWorkoutSyncStatus(): SyncStatus {
  const queue = getWorkoutSyncQueue();
  return useSyncExternalStore(
    (onStoreChange) => queue.subscribe(onStoreChange),
    () => queue.getStatus(),
    () => 'synced' as SyncStatus,
  );
}

/** Call once from root layout — flushes on foreground. */
export function ensureWorkoutSyncListeners(): void {
  if (appStateSub) {
    return;
  }
  const { AppState } = require('react-native') as typeof import('react-native');
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void flushWorkoutSyncQueue().catch(() => {
        // Status already set to offline inside flush.
      });
    }
  });
}

export type {
  SyncStatus,
  SyncQueueOp,
  UpsertSessionOpPayload,
  SyncSetUpsertPayload,
} from './sync-queue';
export { createWorkoutSyncQueue, coalesceOps, WORKOUT_SYNC_QUEUE_KEY } from './sync-queue';
