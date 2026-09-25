/**
 * Rest timer → Live Activity content. Pure: no React, no native modules.
 *
 * Running rests hand the end date to the extension, which counts down on its
 * own (SwiftUI timer text) — the app only updates on +30 / pause / resume /
 * duration changes. Paused rests show the remaining time as static text.
 */
import { displayActiveExerciseName } from '@/lib/workouts/exercise-name';
import type { ActiveSession } from '@/lib/workouts/types';
import {
  formatTimerMmSs,
  remainingMs,
  restProgress,
  type RestTimerClockState,
} from '@/lib/training/rest-timer';

/** Mirrors RestLiveActivityNativeProps (modules/rest-live-activity). */
export type RestLiveActivityContent = {
  title: string;
  exerciseName: string;
  setLabel: string;
  pausedLabel: string;
  doneLabel: string;
  isPaused: boolean;
  /** Epoch ms, start of the progress range; 0 while paused. */
  startMs: number;
  /** Epoch ms when the rest ends; 0 while paused. */
  endMs: number;
  remainingText: string;
  /** 0–1 share of the rest already done (used while paused). */
  pausedProgress: number;
};

export type RestLiveActivityTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export type RestLiveActivityInput = {
  timer: RestTimerClockState & { durationSec: number };
  session: Pick<ActiveSession, 'phase' | 'items' | 'cursor'> | null;
  /** True once the session this rest belonged to was finished or discarded. */
  sessionEnded: boolean;
  lang: string;
  now: number;
  t: RestLiveActivityTranslate;
};

/** The set that comes after this rest: the session cursor, if it points at an open set. */
export function nextSetOf(
  session: Pick<ActiveSession, 'phase' | 'items' | 'cursor'> | null,
): { exerciseIndex: number; set: number; sets: number } | null {
  if (!session || session.phase !== 'active') {
    return null;
  }
  const { exerciseIndex, setIndex } = session.cursor;
  const item = session.items[exerciseIndex];
  const set = item?.sets[setIndex];
  if (!item || !set || set.done || item.skipped) {
    return null;
  }
  return { exerciseIndex, set: setIndex + 1, sets: item.sets.length };
}

/** Null ⇒ no Live Activity (idle / finished rest, session over). */
export function restLiveActivityContent(
  input: RestLiveActivityInput,
): RestLiveActivityContent | null {
  const { timer, session, now, t } = input;
  if (input.sessionEnded) {
    return null;
  }
  if (session && session.phase !== 'active') {
    return null;
  }
  const remaining = remainingMs(timer, now);
  if (remaining <= 0) {
    return null;
  }
  const isPaused = timer.status === 'paused';
  if (!isPaused && (timer.status !== 'running' || timer.endsAt == null)) {
    return null;
  }

  const next = nextSetOf(session);
  const item = next ? session?.items[next.exerciseIndex] : undefined;
  const exerciseName = item ? displayActiveExerciseName(item, input.lang) : '';
  const setLabel = next ? t('liveActivity.nextSet', { set: next.set, sets: next.sets }) : '';

  const base = {
    title: t('liveActivity.title'),
    exerciseName,
    setLabel,
    pausedLabel: t('liveActivity.paused'),
    doneLabel: t('liveActivity.done'),
    remainingText: formatTimerMmSs(remaining),
  };

  if (isPaused) {
    return {
      ...base,
      isPaused: true,
      startMs: 0,
      endMs: 0,
      pausedProgress: restProgress(timer, now),
    };
  }

  const endsAt = timer.endsAt as number;
  // +30 moves endsAt without changing durationSec: never start the range in the future.
  const startMs = Math.min(now, endsAt - Math.max(1, timer.durationSec) * 1000);
  return {
    ...base,
    isPaused: false,
    startMs,
    endMs: endsAt,
    pausedProgress: 0,
  };
}

/** Grace window after the planned end in which a finished rest still vibrates. */
export const REST_END_VIBRATION_WINDOW_MS = 5000;

/**
 * Vibrate when a running rest ran out just now — not when the app returns
 * long after the end (the notification already did its job), and not when
 * −30 cut the rest short.
 */
export function shouldVibrateOnRestEnd(prevEndsAt: number | null, now: number): boolean {
  if (prevEndsAt == null || !Number.isFinite(prevEndsAt)) {
    return false;
  }
  return now >= prevEndsAt - 1000 && now - prevEndsAt <= REST_END_VIBRATION_WINDOW_MS;
}
