import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REST_SECONDS,
  REST_MAX_SECONDS,
  REST_MIN_SECONDS,
  addSecondsToRemaining,
  clampRestSeconds,
  elapsedMs,
  formatHoldMmSs,
  formatTimerMmSs,
  remainingMs,
  restDurationWheelValues,
  restProgress,
  snapRestSeconds,
  type RestTimerClockState,
} from './rest-timer.ts';

describe('remainingMs', () => {
  it('computes max(0, endsAt - now) while running', () => {
    const state: RestTimerClockState = {
      status: 'running',
      endsAt: 10_000,
      remainingOnPause: null,
    };
    assert.equal(remainingMs(state, 7_000), 3_000);
    assert.equal(remainingMs(state, 12_000), 0);
  });

  it('uses remainingOnPause while paused', () => {
    const state: RestTimerClockState = {
      status: 'paused',
      endsAt: null,
      remainingOnPause: 4_500,
    };
    assert.equal(remainingMs(state, 99_000), 4_500);
  });

  it('returns 0 when finished or idle', () => {
    assert.equal(
      remainingMs({ status: 'finished', endsAt: null, remainingOnPause: null }, 1),
      0,
    );
    assert.equal(
      remainingMs({ status: 'idle', endsAt: null, remainingOnPause: null }, 1),
      0,
    );
  });
});

describe('pause / resume semantics', () => {
  it('resume reconstructs endsAt from remainingOnPause', () => {
    const paused: RestTimerClockState = {
      status: 'paused',
      endsAt: null,
      remainingOnPause: 30_000,
    };
    const now = 1_000_000;
    const resumed: RestTimerClockState = {
      status: 'running',
      endsAt: now + (paused.remainingOnPause ?? 0),
      remainingOnPause: null,
    };
    assert.equal(remainingMs(resumed, now), 30_000);
    assert.equal(remainingMs(resumed, now + 10_000), 20_000);
  });
});

describe('addSecondsToRemaining', () => {
  it('clamps at 0 when subtracting past zero', () => {
    assert.equal(addSecondsToRemaining(5_000, -30), 0);
    assert.equal(addSecondsToRemaining(40_000, -30), 10_000);
    assert.equal(addSecondsToRemaining(10_000, 30), 40_000);
  });
});

describe('elapsedMs', () => {
  it('counts up from startedAt', () => {
    assert.equal(elapsedMs(1_000, 4_000), 3_000);
    assert.equal(elapsedMs(5_000, 4_000), 0);
  });
});

describe('formatters / progress', () => {
  it('formats mm:ss for rest (ceil) and hold (floor)', () => {
    assert.equal(formatTimerMmSs(61_200), '01:02');
    assert.equal(formatHoldMmSs(61_200), '01:01');
  });

  it('computes rest progress from remaining', () => {
    const state = {
      status: 'running' as const,
      endsAt: 60_000,
      remainingOnPause: null,
      durationSec: 60,
    };
    assert.equal(restProgress(state, 30_000), 0.5);
  });
});

describe('clampRestSeconds', () => {
  it('keeps values inside the allowed band', () => {
    assert.equal(clampRestSeconds(45), 45);
    assert.equal(clampRestSeconds(REST_MIN_SECONDS), REST_MIN_SECONDS);
    assert.equal(clampRestSeconds(REST_MAX_SECONDS), REST_MAX_SECONDS);
  });

  /** The timer card used to allow 1 s, which the plan's 15 s steps could not undo. */
  it('never drops below the shared floor', () => {
    assert.equal(clampRestSeconds(1), REST_MIN_SECONDS);
    assert.equal(clampRestSeconds(0), REST_MIN_SECONDS);
    assert.equal(clampRestSeconds(-90), REST_MIN_SECONDS);
  });

  it('never exceeds the ceiling', () => {
    assert.equal(clampRestSeconds(REST_MAX_SECONDS + 15), REST_MAX_SECONDS);
    assert.equal(clampRestSeconds(10_000), REST_MAX_SECONDS);
  });

  it('rounds and falls back for junk input', () => {
    assert.equal(clampRestSeconds(44.6), 45);
    assert.equal(clampRestSeconds(Number.NaN), DEFAULT_REST_SECONDS);
  });

  it('walks down in 15 s steps and stops at the floor', () => {
    let value = DEFAULT_REST_SECONDS;
    for (let step = 0; step < 20; step += 1) {
      value = clampRestSeconds(value - 15);
    }
    assert.equal(value, REST_MIN_SECONDS);
    // …and back up lands on a clean multiple again, not 16.
    assert.equal(clampRestSeconds(value + 15), 30);
  });
});

describe('snapRestSeconds', () => {
  it('snaps to the nearest 15 s step inside the band', () => {
    assert.equal(snapRestSeconds(82), 75);
    assert.equal(snapRestSeconds(83), 90);
    assert.equal(snapRestSeconds(7), REST_MIN_SECONDS);
    assert.equal(snapRestSeconds(700), REST_MAX_SECONDS);
  });
});

describe('restDurationWheelValues', () => {
  it('lists 15 s steps from the floor to the ceiling', () => {
    const values = restDurationWheelValues();
    assert.equal(values[0], REST_MIN_SECONDS);
    assert.equal(values[values.length - 1], REST_MAX_SECONDS);
    assert.equal(values.length, (REST_MAX_SECONDS - REST_MIN_SECONDS) / 15 + 1);
  });
});
