import * as Sentry from '@sentry/react-native';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localDateKey } from '@/lib/day-window';
import { createMmkvZustandStorage } from '@/lib/mmkv-zustand-storage';
import {
  type FinishSessionResult,
} from '@/lib/workouts/finish-session';
import { runFinishActiveSession } from '@/lib/workouts/finish-session-runtime';
import {
  addExerciseToSession as addExerciseLogic,
  addSet as addSetLogic,
  adjustCurrent as adjustCurrentLogic,
  allDoneSetUpserts,
  buildActiveSessionFromTemplate,
  completeCurrentSet as completeCurrentSetLogic,
  editDoneSet as editDoneSetLogic,
  jumpTo as jumpToLogic,
  moveExercise as moveExerciseLogic,
  removeLastSet as removeLastSetLogic,
  setCurrent as setCurrentLogic,
  setCurrentSides as setCurrentSidesLogic,
  skipExercise as skipExerciseLogic,
  toSessionSetUpsert,
} from '@/lib/workouts/session-logic';
import {
  enqueueDeleteSession,
  enqueueDeleteSet,
  enqueueUpsertSession,
  enqueueUpsertSets,
  flushWorkoutSyncQueue,
  getWorkoutSyncStatus,
} from '@/lib/workouts/sync-queue-runtime';
import type {
  ActiveSession,
  Exercise,
  GymIntensity,
  WorkoutTemplate,
} from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

type CompleteResult = { restSeconds: number | null; isLastSet: boolean };

type WorkoutSessionState = {
  active: ActiveSession | null;
  startSession: (template: WorkoutTemplate, opts?: { loggedOn?: string; lang?: string }) => void;
  adjustCurrent: (delta: number) => void;
  setCurrent: (value: number) => void;
  setCurrentSides: (seconds: number, secondsOtherSide: number) => void;
  completeCurrentSet: () => CompleteResult | null;
  addSet: (exerciseIndex: number) => void;
  removeLastSet: (exerciseIndex: number) => void;
  skipExercise: (exerciseIndex: number) => void;
  moveExercise: (from: number, to: number) => void;
  jumpTo: (exerciseIndex: number, setIndex: number) => void;
  editDoneSet: (
    exerciseIndex: number,
    setIndex: number,
    value: number,
    otherSide?: number | null,
  ) => void;
  addExerciseToSession: (exercise: Exercise, opts?: { lang?: string }) => void;
  /** Move to summary without finishing (Beenden → Speichern). */
  enterSummary: () => void;
  /** `queryClient` required so invalidateTrainingQueries can run after link. */
  finishSession: (
    intensity: GymIntensity,
    queryClient: QueryClient,
  ) => Promise<FinishSessionResult>;
  discardSession: () => void;
  getSyncStatus: () => ReturnType<typeof getWorkoutSyncStatus>;
};

function enqueueSessionSnapshot(session: ActiveSession): void {
  enqueueUpsertSession({
    id: session.sessionId,
    templateId: session.templateId,
    templateName: session.templateName,
    shortLabel: session.shortLabel,
    colorKey: session.colorKey,
    loggedOn: session.loggedOn,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    intensity: session.intensity,
    trainingSessionId: session.trainingSessionId,
  });
}

function enqueueCompletedSet(
  session: ActiveSession,
  exerciseIndex: number,
  setIndex: number,
): void {
  const payload = toSessionSetUpsert(session, exerciseIndex, setIndex);
  if (payload) {
    enqueueUpsertSets([payload]);
  }
}

function triggerFlush(): void {
  void flushWorkoutSyncQueue().catch(() => {
    // offline status is set inside flush
  });
}

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  persist(
    (set, get) => ({
      active: null,

      startSession: (template, opts) => {
        const session = buildActiveSessionFromTemplate(template, {
          loggedOn: opts?.loggedOn ?? localDateKey(),
          lang: opts?.lang,
        });
        set({ active: session });
        enqueueSessionSnapshot(session);
        triggerFlush();
      },

      adjustCurrent: (delta) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: adjustCurrentLogic(active, delta) });
      },

      setCurrent: (value) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: setCurrentLogic(active, value) });
      },

      setCurrentSides: (seconds, secondsOtherSide) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: setCurrentSidesLogic(active, seconds, secondsOtherSide) });
      },

      completeCurrentSet: () => {
        const active = get().active;
        if (!active) {
          return null;
        }
        const result = completeCurrentSetLogic(active);
        if (!result) {
          return null;
        }
        set({ active: result.session });
        enqueueCompletedSet(result.session, result.exerciseIndex, result.setIndex);
        triggerFlush();
        return { restSeconds: result.restSeconds, isLastSet: result.isLastSet };
      },

      addSet: (exerciseIndex) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: addSetLogic(active, exerciseIndex) });
      },

      removeLastSet: (exerciseIndex) => {
        const active = get().active;
        if (!active) {
          return;
        }
        const { session, deletedSetId } = removeLastSetLogic(active, exerciseIndex);
        set({ active: session });
        if (deletedSetId) {
          enqueueDeleteSet(deletedSetId);
          triggerFlush();
        }
      },

      skipExercise: (exerciseIndex) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: skipExerciseLogic(active, exerciseIndex) });
      },

      moveExercise: (from, to) => {
        const active = get().active;
        if (!active) {
          return;
        }
        const next = moveExerciseLogic(active, from, to);
        set({ active: next });
        const doneUpserts = allDoneSetUpserts(next);
        if (doneUpserts.length > 0) {
          enqueueUpsertSets(doneUpserts);
          triggerFlush();
        }
      },

      jumpTo: (exerciseIndex, setIndex) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: jumpToLogic(active, exerciseIndex, setIndex) });
      },

      editDoneSet: (exerciseIndex, setIndex, value, otherSide) => {
        const active = get().active;
        if (!active) {
          return;
        }
        const next = editDoneSetLogic(active, exerciseIndex, setIndex, value, otherSide);
        set({ active: next });
        enqueueCompletedSet(next, exerciseIndex, setIndex);
        triggerFlush();
      },

      addExerciseToSession: (exercise, opts) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: addExerciseLogic(active, exercise, opts) });
      },

      enterSummary: () => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: { ...active, phase: 'summary' } });
      },

      finishSession: async (intensity, queryClient) => {
        const active = get().active;
        if (!active) {
          return { ok: false, error: new Error('no_active_session'), session: active };
        }

        const userId = useAuthStore.getState().session?.user?.id;
        if (!userId) {
          const error = new Error('not_authenticated');
          Sentry.captureException(error);
          return { ok: false, error, session: active };
        }

        const result = await runFinishActiveSession(active, {
          intensity,
          userId,
          queryClient,
        });

        if (result.ok) {
          set({ active: null });
          return result;
        }

        set({ active: result.session });
        return result;
      },

      discardSession: () => {
        const active = get().active;
        if (!active) {
          return;
        }
        const sessionId = active.sessionId;
        set({ active: null });
        enqueueDeleteSession(sessionId);
        triggerFlush();
      },

      getSyncStatus: () => getWorkoutSyncStatus(),
    }),
    {
      name: 'workout-session-active',
      storage: createJSONStorage(() => createMmkvZustandStorage('training')),
      partialize: (state) => ({ active: state.active }),
    },
  ),
);
