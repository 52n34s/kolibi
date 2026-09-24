/** Pure rest / hold timer math — no React, no MMKV. */

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type RestTimerClockState = {
  status: RestTimerStatus;
  endsAt: number | null;
  remainingOnPause: number | null;
};

export const DEFAULT_REST_SECONDS = 120;

/**
 * Lower bound for the shared standard rest. The timer card and the plan
 * editor edit the same value, so they clamp against the same floor — the card
 * used to allow 1 s, which the plan could then not undo in its 15 s steps.
 */
export const REST_MIN_SECONDS = 15;

/** Upper bound for the shared standard rest. */
export const REST_MAX_SECONDS = 600;

export function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_SECONDS;
  }
  return Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, Math.round(seconds)));
}

/** Nearest 15 s step inside the shared standard band (for the rest duration wheel). */
export function snapRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_SECONDS;
  }
  const stepped = Math.round(seconds / 15) * 15;
  return clampRestSeconds(stepped);
}

/** 15, 30, …, 600 — values shown on the active-rest duration wheel. */
export function restDurationWheelValues(): number[] {
  const values: number[] = [];
  for (let sec = REST_MIN_SECONDS; sec <= REST_MAX_SECONDS; sec += 15) {
    values.push(sec);
  }
  return values;
}

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
