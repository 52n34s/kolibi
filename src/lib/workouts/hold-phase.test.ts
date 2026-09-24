import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canShowHoldReset,
  holdElapsedMs,
  holdResetNeedsConfirm,
  initialHoldPhase,
  isHoldPaused,
  isHoldReady,
  isHoldRunning,
  pauseHold,
  readyValues,
  resetHold,
  resumeHold,
  startHold,
  stopHold,
  switchSide,
  type HoldPhase,
} from './hold-phase.ts';

const OPEN_SET = {
  done: false,
  isEditingDone: false,
  value: 20,
  secondsOtherSide: null,
};

describe('initialHoldPhase', () => {
  it('starts a fresh set on the timer', () => {
    assert.deepEqual(initialHoldPhase(OPEN_SET), { status: 'idle' });
  });

  it('starts an already logged set on the stepper', () => {
    assert.deepEqual(
      initialHoldPhase({ ...OPEN_SET, done: true, value: 34 }),
      { status: 'ready', seconds: 34, secondsOtherSide: null },
    );
  });

  it('keeps both sides when re-opening a per-side set', () => {
    assert.deepEqual(
      initialHoldPhase({
        done: true,
        isEditingDone: true,
        value: 22,
        secondsOtherSide: 25,
      }),
      { status: 'ready', seconds: 22, secondsOtherSide: 25 },
    );
  });
});

describe('single-side hold', () => {
  it('runs idle → holding → ready', () => {
    let phase: HoldPhase = initialHoldPhase(OPEN_SET);
    assert.equal(isHoldRunning(phase), false);

    phase = startHold(phase, 1_000);
    assert.equal(isHoldRunning(phase), true);
    assert.equal(holdElapsedMs(phase, 13_000), 12_000);

    phase = stopHold(phase, 13_400, false);
    assert.equal(isHoldReady(phase), true);
    assert.deepEqual(readyValues(phase), { seconds: 12, secondsOtherSide: null });
  });

  it('floors to whole seconds and never goes negative', () => {
    const running = startHold(initialHoldPhase(OPEN_SET), 5_000);
    assert.deepEqual(readyValues(stopHold(running, 5_999, false)), {
      seconds: 0,
      secondsOtherSide: null,
    });
    assert.deepEqual(readyValues(stopHold(running, 4_000, false)), {
      seconds: 0,
      secondsOtherSide: null,
    });
  });
});

describe('pause / resume', () => {
  it('Anhalten and Weiter across a wall-clock jump exclude pause duration', () => {
    let phase: HoldPhase = startHold(initialHoldPhase(OPEN_SET), 1_000);
    assert.equal(holdElapsedMs(phase, 11_000), 10_000);

    phase = pauseHold(phase, 11_000);
    assert.equal(isHoldPaused(phase), true);
    assert.equal(isHoldRunning(phase), false);
    // Frozen at pause even if wall clock jumps a minute.
    assert.equal(holdElapsedMs(phase, 71_000), 10_000);

    phase = resumeHold(phase, 71_000);
    assert.equal(isHoldRunning(phase), true);
    assert.equal(holdElapsedMs(phase, 76_000), 15_000);

    phase = stopHold(phase, 76_000, false);
    assert.deepEqual(readyValues(phase), { seconds: 15, secondsOtherSide: null });
  });

  it('stop while paused adopts the frozen elapsed, not wall time after pause', () => {
    let phase: HoldPhase = startHold(initialHoldPhase(OPEN_SET), 0);
    phase = pauseHold(phase, 8_500);
    phase = stopHold(phase, 99_000, false);
    assert.deepEqual(readyValues(phase), { seconds: 8, secondsOtherSide: null });
  });

  it('reset clears a first-side run to idle and a second-side run to awaiting', () => {
    let phase: HoldPhase = startHold(initialHoldPhase(OPEN_SET), 0);
    phase = pauseHold(phase, 3_000);
    assert.deepEqual(resetHold(phase), { status: 'idle' });

    phase = startHold(initialHoldPhase(OPEN_SET), 0);
    phase = stopHold(phase, 20_000, true);
    phase = switchSide(phase, 30_000);
    phase = pauseHold(phase, 35_000);
    assert.deepEqual(resetHold(phase), {
      status: 'awaitingOtherSide',
      firstSideSec: 20,
    });
  });

  it('shows reset when paused or after time has started; confirm only past 10 s', () => {
    const fresh = startHold(initialHoldPhase(OPEN_SET), 1_000);
    assert.equal(canShowHoldReset(fresh, 1_000), false);
    assert.equal(canShowHoldReset(fresh, 1_001), true);
    assert.equal(holdResetNeedsConfirm(fresh, 11_000), false);
    assert.equal(holdResetNeedsConfirm(fresh, 11_001), true);

    const paused = pauseHold(fresh, 5_000);
    assert.equal(canShowHoldReset(paused, 5_000), true);
    assert.equal(holdResetNeedsConfirm(paused, 5_000), false);
  });
});

describe('per-side hold', () => {
  it('runs through both sides before it is ready', () => {
    let phase: HoldPhase = initialHoldPhase(OPEN_SET);

    phase = startHold(phase, 0);
    phase = stopHold(phase, 22_000, true);
    assert.equal(phase.status, 'awaitingOtherSide');
    assert.equal(isHoldReady(phase), false);
    assert.equal(readyValues(phase), null);

    phase = switchSide(phase, 30_000);
    assert.equal(isHoldRunning(phase), true);

    phase = stopHold(phase, 55_000, true);
    assert.equal(isHoldReady(phase), true);
    assert.deepEqual(readyValues(phase), { seconds: 22, secondsOtherSide: 25 });
  });

  it('ignores switchSide unless a side is parked', () => {
    const idle = initialHoldPhase(OPEN_SET);
    assert.deepEqual(switchSide(idle, 1_000), idle);

    const running = startHold(idle, 1_000);
    assert.deepEqual(switchSide(running, 2_000), running);
  });
});

describe('ready is stable', () => {
  /** The regression this machine exists for: writing the value must not reset it. */
  it('stays ready no matter how often the surrounding set value changes', () => {
    let phase: HoldPhase = startHold(initialHoldPhase(OPEN_SET), 0);
    phase = stopHold(phase, 31_000, false);
    assert.equal(isHoldReady(phase), true);

    // The component re-renders on every stepper tap; the phase is untouched.
    for (const _value of [31, 36, 41, 36, 31]) {
      assert.equal(isHoldReady(phase), true);
    }
    assert.deepEqual(readyValues(phase), { seconds: 31, secondsOtherSide: null });
  });

  it('ignores a second stop', () => {
    const ready = stopHold(startHold(initialHoldPhase(OPEN_SET), 0), 12_000, false);
    assert.deepEqual(stopHold(ready, 99_000, false), ready);
  });

  it('only leaves ready when the set itself changes', () => {
    const ready = stopHold(startHold(initialHoldPhase(OPEN_SET), 0), 12_000, false);
    assert.equal(isHoldReady(ready), true);

    // New set → the component rebuilds the phase from scratch.
    assert.deepEqual(initialHoldPhase(OPEN_SET), { status: 'idle' });
  });
});

describe('guards', () => {
  it('ignores stop while idle', () => {
    const idle = initialHoldPhase(OPEN_SET);
    assert.deepEqual(stopHold(idle, 1_000, false), idle);
  });

  it('does not restart a running or paused hold', () => {
    const running = startHold(initialHoldPhase(OPEN_SET), 1_000);
    assert.deepEqual(startHold(running, 9_000), running);
    const paused = pauseHold(running, 2_000);
    assert.deepEqual(startHold(paused, 9_000), paused);
  });

  it('reports no elapsed time outside holding and paused', () => {
    assert.equal(holdElapsedMs(initialHoldPhase(OPEN_SET), 10_000), 0);
    const ready = stopHold(startHold(initialHoldPhase(OPEN_SET), 0), 5_000, false);
    assert.equal(holdElapsedMs(ready, 10_000), 0);
  });
});
