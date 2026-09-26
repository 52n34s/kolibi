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

/**
 * The one rule for an exercise's effective rest, used by the active session,
 * the rest timer, and the plan editor's preview alike: the plan's own value
 * if the exercise has one, else the shared standard rest. The exercise
 * catalog's own default_rest_seconds is never read here — it only seeds a
 * new custom value once, when a plan editor turns "use the standard" off.
 */
export function resolveRestSeconds(
  templateRestSeconds: number | null | undefined,
  standardRestSeconds: number,
): number {
  return templateRestSeconds ?? standardRestSeconds;
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

/** A unit's lifecycle step that decides what happens to the rest timer. */
export type SessionTimerEvent = 'start' | 'finish' | 'discard' | 'summary' | 'resume';

/**
 * The rest belongs to the unit it was started in. A new unit, a saved or a
 * discarded one ends it — otherwise the next unit opened with the old
 * "Weiter geht's" bar, and a running rest still rang after the unit was saved.
 * The summary keeps it: "Zurück zur Einheit" continues the same rest.
 */
export function shouldStopRestTimer(event: SessionTimerEvent, status: RestTimerStatus): boolean {
  if (status === 'idle') {
    return false;
  }
  return event === 'start' || event === 'finish' || event === 'discard';
}
