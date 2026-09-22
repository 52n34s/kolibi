import i18n from '@/i18n';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getMmkv, createMmkvZustandStorage } from '@/lib/mmkv-zustand-storage';
import {
  cancelLocal,
  ensureLocalNotificationPermission,
  scheduleLocalAt,
} from '@/lib/notifications-local';
import {
  addSecondsToRemaining,
  DEFAULT_REST_SECONDS,
  remainingMs,
  type RestTimerStatus,
} from '@/lib/training/rest-timer';

const LAST_DURATION_KEY = 'training.rest_seconds_last';
const PERSIST_NAME = 'rest-timer';

function readLastDurationSec(): number {
  const raw = getMmkv('app-settings').getString(LAST_DURATION_KEY);
  if (raw == null) {
    return DEFAULT_REST_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REST_SECONDS;
  }
  return Math.round(parsed);
}

function writeLastDurationSec(sec: number): void {
  const clamped = Math.max(1, Math.round(sec));
  getMmkv('app-settings').set(LAST_DURATION_KEY, String(clamped));
}

type RestTimerState = {
  status: RestTimerStatus;
  endsAt: number | null;
  remainingOnPause: number | null;
  durationSec: number;
  notificationId: string | null;
  /** Prefill for idle card; synced from last manual duration. */
  idleDurationSec: number;

  getLastDurationSec: () => number;
  setIdleDurationSec: (sec: number) => void;
  start: (sec?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  skip: () => Promise<void>;
  addSeconds: (delta: number) => Promise<void>;
  /** Call from tick when remaining hits 0 while running. */
  markFinishedIfDue: (now?: number) => void;
  acknowledgeFinished: () => void;
  /** Cancel a pending notification and forget the timer — used on sign-out. */
  resetForSignOut: () => Promise<void>;
};

async function cancelCurrentNotification(id: string | null): Promise<void> {
  await cancelLocal(id);
}

async function scheduleRestNotification(endsAt: number): Promise<string | null> {
  await ensureLocalNotificationPermission();
  return scheduleLocalAt(
    new Date(endsAt),
    { body: i18n.t('training.timer.notification') },
    { kind: 'rest-timer' },
  );
}

export const useRestTimerStore = create<RestTimerState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      endsAt: null,
      remainingOnPause: null,
      durationSec: DEFAULT_REST_SECONDS,
      notificationId: null,
      idleDurationSec: DEFAULT_REST_SECONDS,

      getLastDurationSec: () => readLastDurationSec(),

      setIdleDurationSec: (sec) => {
        const next = Math.max(1, Math.round(sec));
        writeLastDurationSec(next);
        set({ idleDurationSec: next, durationSec: next });
      },

      start: async (sec) => {
        const durationSec = Math.max(1, Math.round(sec ?? get().idleDurationSec ?? readLastDurationSec()));
        // Exercise restSeconds may call start(sec) — do NOT write last duration.
        const now = Date.now();
        const endsAt = now + durationSec * 1000;
        await cancelCurrentNotification(get().notificationId);
        const notificationId = await scheduleRestNotification(endsAt);
        set({
          status: 'running',
          endsAt,
          remainingOnPause: null,
          durationSec,
          notificationId,
        });
      },

      pause: async () => {
        const state = get();
        if (state.status !== 'running' || state.endsAt == null) {
          return;
        }
        const now = Date.now();
        const remainingOnPause = remainingMs(state, now);
        await cancelCurrentNotification(state.notificationId);
        set({
          status: 'paused',
          endsAt: null,
          remainingOnPause,
          notificationId: null,
        });
      },

      resume: async () => {
        const state = get();
        if (state.status !== 'paused') {
          return;
        }
        const remaining = Math.max(0, state.remainingOnPause ?? 0);
        if (remaining <= 0) {
          set({
            status: 'finished',
            endsAt: null,
            remainingOnPause: null,
            notificationId: null,
          });
          return;
        }
        const now = Date.now();
        const endsAt = now + remaining;
        const notificationId = await scheduleRestNotification(endsAt);
        set({
          status: 'running',
          endsAt,
          remainingOnPause: null,
          notificationId,
        });
      },

      stop: async () => {
        const state = get();
        await cancelCurrentNotification(state.notificationId);
        set({
          status: 'idle',
          endsAt: null,
          remainingOnPause: null,
          notificationId: null,
          durationSec: state.idleDurationSec,
        });
      },

      skip: async () => {
        await get().stop();
      },

      addSeconds: async (delta) => {
        const state = get();
        if (state.status === 'idle' || state.status === 'finished') {
          const next = Math.max(1, state.idleDurationSec + delta);
          writeLastDurationSec(next);
          set({ idleDurationSec: next, durationSec: next });
          return;
        }

        if (state.status === 'paused') {
          const remainingOnPause = addSecondsToRemaining(state.remainingOnPause ?? 0, delta);
          set({ remainingOnPause });
          return;
        }

        if (state.status === 'running' && state.endsAt != null) {
          const now = Date.now();
          const left = remainingMs(state, now);
          const nextLeft = addSecondsToRemaining(left, delta);
          await cancelCurrentNotification(state.notificationId);
          if (nextLeft <= 0) {
            set({
              status: 'finished',
              endsAt: null,
              remainingOnPause: null,
              notificationId: null,
            });
            return;
          }
          const endsAt = now + nextLeft;
          const notificationId = await scheduleRestNotification(endsAt);
          set({ endsAt, notificationId });
        }
      },

      markFinishedIfDue: (now = Date.now()) => {
        const state = get();
        if (state.status !== 'running') {
          return;
        }
        if (remainingMs(state, now) > 0) {
          return;
        }
        const notificationId = state.notificationId;
        set({
          status: 'finished',
          endsAt: null,
          remainingOnPause: null,
          notificationId: null,
        });
        void cancelCurrentNotification(notificationId);
      },

      resetForSignOut: async () => {
        const state = get();
        await cancelCurrentNotification(state.notificationId);
        set({
          status: 'idle',
          endsAt: null,
          remainingOnPause: null,
          notificationId: null,
          durationSec: DEFAULT_REST_SECONDS,
          idleDurationSec: DEFAULT_REST_SECONDS,
        });
      },

      acknowledgeFinished: () => {
        const state = get();
        set({
          status: 'idle',
          endsAt: null,
          remainingOnPause: null,
          notificationId: null,
          durationSec: state.idleDurationSec,
        });
      },
    }),
    {
      name: PERSIST_NAME,
      storage: createJSONStorage(() => createMmkvZustandStorage('training')),
      partialize: (state) => ({
        status: state.status,
        endsAt: state.endsAt,
        remainingOnPause: state.remainingOnPause,
        durationSec: state.durationSec,
        notificationId: state.notificationId,
        idleDurationSec: state.idleDurationSec,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        const last = readLastDurationSec();
        if (state.status === 'idle' || state.status === 'finished') {
          state.idleDurationSec = last;
          state.durationSec = last;
        }
      },
    },
  ),
);
