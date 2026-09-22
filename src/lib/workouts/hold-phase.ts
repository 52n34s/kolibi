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
 *   idle → holding → ready                     (single side)
 *   idle → holding → awaitingOtherSide
 *               ↘ holding → ready              (per side)
 */

export type HoldPhase =
  | { status: 'idle' }
  | { status: 'holding'; startedAt: number; firstSideSec: number | null }
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

function wholeSeconds(fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((toMs - fromMs) / 1000));
}

/** Start (or restart) the timer. A running hold is left untouched. */
export function startHold(phase: HoldPhase, now: number): HoldPhase {
  if (phase.status === 'holding') {
    return phase;
  }
  return { status: 'holding', startedAt: now, firstSideSec: null };
}

/**
 * Stop the running hold. For a per-side exercise the first stop parks the
 * result and waits for the other side; the second stop completes the set.
 */
export function stopHold(phase: HoldPhase, now: number, perSide: boolean): HoldPhase {
  if (phase.status !== 'holding') {
    return phase;
  }
  const seconds = wholeSeconds(phase.startedAt, now);

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
  return { status: 'holding', startedAt: now, firstSideSec: phase.firstSideSec };
}

export function isHoldRunning(phase: HoldPhase): boolean {
  return phase.status === 'holding';
}

export function isHoldReady(phase: HoldPhase): boolean {
  return phase.status === 'ready';
}

export function holdElapsedMs(phase: HoldPhase, now: number): number {
  if (phase.status !== 'holding') {
    return 0;
  }
  return Math.max(0, now - phase.startedAt);
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
