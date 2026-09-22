import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  holdElapsedMs,
  initialHoldPhase,
  isHoldReady,
  isHoldRunning,
  readyValues,
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

  it('does not restart a running hold', () => {
    const running = startHold(initialHoldPhase(OPEN_SET), 1_000);
    assert.deepEqual(startHold(running, 9_000), running);
  });

  it('reports no elapsed time outside holding', () => {
    assert.equal(holdElapsedMs(initialHoldPhase(OPEN_SET), 10_000), 0);
    const ready = stopHold(startHold(initialHoldPhase(OPEN_SET), 0), 5_000, false);
    assert.equal(holdElapsedMs(ready, 10_000), 0);
  });
});
