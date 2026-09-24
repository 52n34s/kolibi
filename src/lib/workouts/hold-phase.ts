/**
 * Hold-timer phase machine for time-based sets.
 *
 * Lives here as a pure reducer because the previous version kept a `timeReady`
 * flag in a `useEffect` that also depended on `set.value`. Stopping the timer
 * writes the value, the effect re-ran and reset the flag, and the hold timer
 * reappeared before the user could hit "Satz fertig" — the set was unloggable.
 *
 * The phase now only ever leaves `ready` when the set itself changes, which the
 * component detects via `set.id`.
 *
 * Clock model (wall-clock reconstructible after background / kill):
 *   elapsedMs = (now - startedAt) - pausedAccumMs
 * Pause freezes that expression at `pausedAt`. Resume adds the pause span to
 * `pausedAccumMs` and keeps the original `startedAt`.
 *
 *   idle → holding ⇄ paused → ready                     (single side)
 *   idle → holding ⇄ paused → awaitingOtherSide
 *               ↘ holding ⇄ paused → ready              (per side)
 */

export type HoldPhase =
  | { status: 'idle' }
  | {
      status: 'holding';
      startedAt: number;
      pausedAccumMs: number;
      firstSideSec: number | null;
    }
  | {
      status: 'paused';
      startedAt: number;
      pausedAccumMs: number;
      /** Wall time when Anhalten was pressed — freezes the display. */
      pausedAt: number;
      firstSideSec: number | null;
    }
  | { status: 'awaitingOtherSide'; firstSideSec: number }
  | { status: 'ready'; seconds: number; secondsOtherSide: number | null };

export const IDLE_HOLD_PHASE: HoldPhase = { status: 'idle' };

/** A set that is already logged starts on the stepper, not on the timer. */
export function initialHoldPhase(input: {
  done: boolean;
  isEditingDone: boolean;
  value: number;
  secondsOtherSide: number | null;
}): HoldPhase {
  if (input.done || input.isEditingDone) {
    return {
      status: 'ready',
      seconds: input.value,
      secondsOtherSide: input.secondsOtherSide,
    };
  }
  return IDLE_HOLD_PHASE;
}

function wholeSecondsFromElapsedMs(elapsedMs: number): number {
  if (!(elapsedMs > 0)) {
    return 0;
  }
  return Math.floor(elapsedMs / 1000);
}

/** Start (or restart) the timer. A running or paused hold is left untouched. */
export function startHold(phase: HoldPhase, now: number): HoldPhase {
  if (phase.status === 'holding' || phase.status === 'paused') {
    return phase;
  }
  return {
    status: 'holding',
    startedAt: now,
    pausedAccumMs: 0,
    firstSideSec: null,
  };
}

/** Freeze the clock without adopting the value. */
export function pauseHold(phase: HoldPhase, now: number): HoldPhase {
  if (phase.status !== 'holding') {
    return phase;
  }
  return {
    status: 'paused',
    startedAt: phase.startedAt,
    pausedAccumMs: phase.pausedAccumMs,
    pausedAt: now,
    firstSideSec: phase.firstSideSec,
  };
}

/** Continue from the same stand after Anhalten. */
export function resumeHold(phase: HoldPhase, now: number): HoldPhase {
  if (phase.status !== 'paused') {
    return phase;
  }
  const pauseDuration = Math.max(0, now - phase.pausedAt);
  return {
    status: 'holding',
    startedAt: phase.startedAt,
    pausedAccumMs: phase.pausedAccumMs + pauseDuration,
    firstSideSec: phase.firstSideSec,
  };
}

/**
 * Clear the current run back to idle (or awaitingOtherSide when the first
 * per-side result is already parked).
 */
export function resetHold(phase: HoldPhase): HoldPhase {
  if (phase.status !== 'holding' && phase.status !== 'paused') {
    return phase;
  }
  if (phase.firstSideSec != null) {
    return { status: 'awaitingOtherSide', firstSideSec: phase.firstSideSec };
  }
  return IDLE_HOLD_PHASE;
}

/**
 * Stop the running or paused hold. For a per-side exercise the first stop parks
 * the result and waits for the other side; the second stop completes the set.
 */
export function stopHold(phase: HoldPhase, now: number, perSide: boolean): HoldPhase {
  if (phase.status !== 'holding' && phase.status !== 'paused') {
    return phase;
  }
  const seconds = wholeSecondsFromElapsedMs(holdElapsedMs(phase, now));

  if (perSide && phase.firstSideSec == null) {
    return { status: 'awaitingOtherSide', firstSideSec: seconds };
  }

  if (perSide && phase.firstSideSec != null) {
    return {
      status: 'ready',
      seconds: phase.firstSideSec,
      secondsOtherSide: seconds,
    };
  }

  return { status: 'ready', seconds, secondsOtherSide: null };
}

/** Begin the second side after the first one was stopped. */
export function switchSide(phase: HoldPhase, now: number): HoldPhase {
  if (phase.status !== 'awaitingOtherSide') {
    return phase;
  }
  return {
    status: 'holding',
    startedAt: now,
    pausedAccumMs: 0,
    firstSideSec: phase.firstSideSec,
  };
}

export function isHoldRunning(phase: HoldPhase): boolean {
  return phase.status === 'holding';
}

export function isHoldPaused(phase: HoldPhase): boolean {
  return phase.status === 'paused';
}

export function isHoldReady(phase: HoldPhase): boolean {
  return phase.status === 'ready';
}

/**
 * Active hold elapsed in ms.
 * holding: (now - startedAt) - pausedAccumMs
 * paused:  (pausedAt - startedAt) - pausedAccumMs  (frozen)
 */
export function holdElapsedMs(phase: HoldPhase, now: number): number {
  if (phase.status === 'holding') {
    return Math.max(0, now - phase.startedAt - phase.pausedAccumMs);
  }
  if (phase.status === 'paused') {
    return Math.max(0, phase.pausedAt - phase.startedAt - phase.pausedAccumMs);
  }
  return 0;
}

/** Reset chip: visible while paused, or while holding after time has started. */
export function canShowHoldReset(phase: HoldPhase, now: number): boolean {
  if (phase.status === 'paused') {
    return true;
  }
  if (phase.status === 'holding') {
    return holdElapsedMs(phase, now) > 0;
  }
  return false;
}

/** Confirm dialog only when the current run has more than 10 s. */
export function holdResetNeedsConfirm(phase: HoldPhase, now: number): boolean {
  return holdElapsedMs(phase, now) > 10_000;
}

/** Values to write once the phase reached `ready`, else null. */
export function readyValues(
  phase: HoldPhase,
): { seconds: number; secondsOtherSide: number | null } | null {
  if (phase.status !== 'ready') {
    return null;
  }
  return { seconds: phase.seconds, secondsOtherSide: phase.secondsOtherSide };
}
