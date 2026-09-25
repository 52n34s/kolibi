import * as Sentry from '@sentry/react-native';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { localDateKey } from '@/lib/day-window';
import { createMmkvZustandStorage } from '@/lib/mmkv-zustand-storage';
import { createSingleFlight } from '@/lib/single-flight';
import type { LastSetsByExercise } from '@/lib/workouts/set-prefill';
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
  enterSummaryAt,
  jumpTo as jumpToLogic,
  moveExercise as moveExerciseLogic,
  removeLastSet as removeLastSetLogic,
  removeOpenTrailingSet as removeOpenTrailingSetLogic,
  resumeFromSummary,
  setCurrent as setCurrentLogic,
  setCurrentRir as setCurrentRirLogic,
  setCurrentSides as setCurrentSidesLogic,
  skipExercise as skipExerciseLogic,
  toSessionSetUpsert,
} from '@/lib/workouts/session-logic';
import { keepSessionForUser, sessionOwnership } from '@/lib/workouts/session-owner';
import {
  clearWorkoutSyncQueue,
  enqueueDeleteSession,
  enqueueDeleteSet,
  enqueueUpsertSession,
  enqueueUpsertSets,
  flushWorkoutSyncQueue,
  getWorkoutSyncStatus,
} from '@/lib/workouts/sync-queue-runtime';
import {
  emptySummaryDraft,
  type ActiveSession,
  type Exercise,
  type GymIntensity,
  type SummaryDraft,
  type WorkoutTemplate,
} from '@/lib/workouts/types';
import { useAuthStore } from '@/stores/auth-store';

/** Sessions persisted before summaryDraft existed come back without one. */
export function summaryDraftOf(session: ActiveSession): SummaryDraft {
  return session.summaryDraft ?? emptySummaryDraft();
}

type CompleteResult = { restSeconds: number | null; isLastSet: boolean };

type WorkoutSessionState = {
  active: ActiveSession | null;
  startSession: (
    template: WorkoutTemplate,
    opts?: { loggedOn?: string; lang?: string; lastSetsByExercise?: LastSetsByExercise },
  ) => void;
  adjustCurrent: (delta: number) => void;
  setCurrent: (value: number) => void;
  setCurrentSides: (seconds: number, secondsOtherSide: number) => void;
  /** "Wie viele wären noch gegangen?" for the open set; null clears it. */
  setCurrentRir: (rir: number | null) => void;
  completeCurrentSet: () => CompleteResult | null;
  addSet: (exerciseIndex: number) => void;
  removeLastSet: (exerciseIndex: number) => void;
  /** Chip-bar only: open trailing set, length > 1. No-op otherwise; no server delete. */
  removeOpenTrailingSet: (exerciseIndex: number, setIndex: number) => void;
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
  /** Back out of the summary while nothing has been written yet. */
  resumeSession: () => void;
  /** Persisted summary choices — survives tab switches and app restarts. */
  updateSummaryDraft: (patch: Partial<SummaryDraft>) => void;
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
    userId: session.userId,
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

/**
 * A second tap on "Fertig" gets the running finish instead of a second
 * training_sessions insert (source of the phantom "Manuell · Krafttraining" rows).
 */
const runFinishOnce = createSingleFlight<FinishSessionResult>();

function triggerFlush(): void {
  void flushWorkoutSyncQueue().catch(() => {
    // offline status is set inside flush
  });
}

async function finishOnce(
  active: ActiveSession,
  intensity: GymIntensity,
  queryClient: QueryClient,
  set: (partial: Pick<WorkoutSessionState, 'active'>) => void,
): Promise<FinishSessionResult> {
  // The session's own owner, never the currently signed-in user: a
  // session started by A must not be filed under B after a switch.
  const currentUserId = useAuthStore.getState().session?.user?.id;
  if (!currentUserId) {
    const error = new Error('not_authenticated');
    Sentry.captureException(error);
    return { ok: false, error, session: active };
  }
  if (currentUserId !== active.userId) {
    const error = new Error('session_owner_mismatch');
    Sentry.captureException(error);
    return { ok: false, error, session: active };
  }

  const result = await runFinishActiveSession(active, {
    intensity,
    userId: active.userId,
    queryClient,
  });

  // Keeps trainingSessionId on failure, so a retry links instead of inserting again.
  set({ active: result.ok ? null : result.session });
  return result;
}

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  persist(
    (set, get) => ({
      active: null,

      startSession: (template, opts) => {
        const userId = useAuthStore.getState().session?.user?.id;
        if (!userId) {
          // No account, no session: everything this writes is owner-scoped.
          return;
        }
        const session = buildActiveSessionFromTemplate(template, {
          userId,
          loggedOn: opts?.loggedOn ?? localDateKey(),
          lang: opts?.lang,
          lastSetsByExercise: opts?.lastSetsByExercise,
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

      setCurrentRir: (rir) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({ active: setCurrentRirLogic(active, rir) });
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
          enqueueDeleteSet(deletedSetId, active.userId);
          triggerFlush();
        }
      },

      removeOpenTrailingSet: (exerciseIndex, setIndex) => {
        const active = get().active;
        if (!active) {
          return;
        }
        const { session } = removeOpenTrailingSetLogic(active, exerciseIndex, setIndex);
        set({ active: session });
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
        set({ active: enterSummaryAt(active, new Date().toISOString()) });
      },

      updateSummaryDraft: (patch) => {
        const active = get().active;
        if (!active) {
          return;
        }
        set({
          active: {
            ...active,
            summaryDraft: { ...summaryDraftOf(active), ...patch },
          },
        });
      },

      resumeSession: () => {
        const active = get().active;
        // Only before finishSession ran — afterwards there is no session left.
        if (!active || active.phase !== 'summary') {
          return;
        }
        set({ active: resumeFromSummary(active) });
      },

      finishSession: (intensity, queryClient) => {
        const active = get().active;
        if (!active) {
          return Promise.resolve({
            ok: false,
            error: new Error('no_active_session'),
            session: active,
          });
        }
        return runFinishOnce(active.sessionId, () =>
          finishOnce(active, intensity, queryClient, set),
        );
      },


      discardSession: () => {
        const active = get().active;
        if (!active) {
          return;
        }
        const sessionId = active.sessionId;
        set({ active: null });
        // A failed finish may have inserted training_sessions already; without
        // the link, deleting the workout session alone would leave it behind.
        enqueueDeleteSession(sessionId, active.userId, active.trainingSessionId);
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


/**
 * Drop a persisted session that does not belong to `currentUserId`.
 * Call on app start and on every auth change — MMKV survives a sign-out.
 */
export function purgeForeignActiveSession(currentUserId: string | null): void {
  const { active } = useWorkoutSessionStore.getState();
  const verdict = sessionOwnership(active, currentUserId);
  if (verdict === 'keep' || verdict === 'no-session') {
    return;
  }
  if (verdict === 'foreign' || verdict === 'unowned') {
    Sentry.addBreadcrumb({
      category: 'workout-session',
      level: 'warning',
      message: `dropped ${verdict} active session`,
      data: { sessionId: active?.sessionId ?? null },
    });
  }
  useWorkoutSessionStore.setState({ active: keepSessionForUser(active, currentUserId) });
}

/**
 * Everything the training feature persists, wiped. Used on sign-out so the
 * next account starts clean.
 */
export function clearTrainingStateForSignOut(): void {
  useWorkoutSessionStore.setState({ active: null });
  clearWorkoutSyncQueue();
}
