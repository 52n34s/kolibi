import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addSecondsToRemaining,
  elapsedMs,
  formatHoldMmSs,
  formatTimerMmSs,
  remainingMs,
  restProgress,
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
