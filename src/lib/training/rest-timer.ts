/** Pure rest / hold timer math — no React, no MMKV. */

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type RestTimerClockState = {
  status: RestTimerStatus;
  endsAt: number | null;
  remainingOnPause: number | null;
};

export const DEFAULT_REST_SECONDS = 120;

/** Remaining rest time; always derived from endsAt (or remainingOnPause when paused). */
export function remainingMs(state: RestTimerClockState, now: number): number {
  if (state.status === 'paused') {
    return Math.max(0, state.remainingOnPause ?? 0);
  }
  if (state.status === 'running' && state.endsAt != null) {
    return Math.max(0, state.endsAt - now);
  }
  if (state.status === 'finished') {
    return 0;
  }
  return 0;
}

/** Elapsed hold time from startedAt. */
export function elapsedMs(startedAt: number, now: number): number {
  if (!(startedAt > 0) || !(now >= startedAt)) {
    return 0;
  }
  return now - startedAt;
}

/** Apply ±seconds to a remaining duration; never below 0. */
export function addSecondsToRemaining(remainingMsValue: number, deltaSec: number): number {
  const next = remainingMsValue + deltaSec * 1000;
  return Math.max(0, next);
}

export function formatTimerMmSs(totalMs: number): string {
  const totalSec = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatHoldMmSs(totalMs: number): string {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Progress 0–1 for a running rest of known durationSec. */
export function restProgress(
  state: RestTimerClockState & { durationSec: number },
  now: number,
): number {
  const durationMs = Math.max(1, state.durationSec * 1000);
  const left = remainingMs(state, now);
  return Math.min(1, Math.max(0, 1 - left / durationMs));
}
