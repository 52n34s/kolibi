import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProgressionHistorySet, ProgressionHistoryUnit } from './progression.ts';
import {
  isClearlyBelowTarget,
  isTooHardStreak,
  normalizeShortfallReasons,
  sessionHasClearShortfall,
  shortfallReasonsToSave,
  toggleShortfallReason,
} from './shortfall.ts';
import type { ActiveExercise } from './types.ts';

const reps = { kind: 'reps' as const, perSide: false };

function set(value: number, partial: Partial<ProgressionHistorySet> = {}): ProgressionHistorySet {
  return {
    reps: value,
    seconds: null,
    secondsOtherSide: null,
    targetReps: 10,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    done: true,
    ...partial,
  };
}

function timeSet(seconds: number, other: number | null = null): ProgressionHistorySet {
  return {
    reps: null,
    seconds,
    secondsOtherSide: other,
    targetReps: null,
    targetRepsMax: null,
    targetSeconds: 30,
    targetSecondsMax: 45,
    done: true,
  };
}

function unit(
  sessionId: string,
  sets: ProgressionHistorySet[],
  shortfallReasons: string[] | null = null,
): ProgressionHistoryUnit {
  return { sessionId, intensity: 'normal', sets, shortfallReasons };
}

function item(values: number[], partial: Partial<ActiveExercise> = {}, done = true): ActiveExercise {
  return {
    exerciseId: 'ex1',
    name: 'Push-up',
    kind: 'reps',
    perSide: false,
    imageAsset: null,
    imagePath: null,
    note: null,
    targetSets: values.length,
    targetReps: 10,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: 90,
    addedInSession: false,
    skipped: false,
    sets: values.map((value, i) => ({
      id: `s${i}`,
      value,
      done,
      completedAt: done ? '2026-09-25T10:00:00.000Z' : null,
      secondsOtherSide: null,
    })),
    ...partial,
  };
}

describe('isClearlyBelowTarget', () => {
  it('best set under 70 % of the lower bound → clearly below', () => {
    assert.equal(isClearlyBelowTarget(reps, [set(6)]), true);
  });

  it('best set exactly at 70 % is not clearly below (one set under the bound)', () => {
    assert.equal(isClearlyBelowTarget(reps, [set(7), set(12)]), false);
  });

  it('two sets under the lower bound → clearly below', () => {
    assert.equal(isClearlyBelowTarget(reps, [set(9), set(9), set(12)]), true);
  });

  it('one set under the lower bound, best fine → not clearly below', () => {
    assert.equal(isClearlyBelowTarget(reps, [set(9), set(10), set(12)]), false);
  });

  it('open sets are ignored', () => {
    assert.equal(
      isClearlyBelowTarget(reps, [set(12), set(10, { done: false }), set(10, { done: false })]),
      false,
    );
    assert.equal(isClearlyBelowTarget(reps, [set(3, { done: false })]), false);
  });

  it('no lower bound → never clearly below', () => {
    assert.equal(isClearlyBelowTarget(reps, [set(1, { targetReps: null })]), false);
  });

  it('time: per-side uses the weaker side', () => {
    const shape = { kind: 'time' as const, perSide: true };
    assert.equal(isClearlyBelowTarget(shape, [timeSet(40, 20)]), true);
    assert.equal(isClearlyBelowTarget(shape, [timeSet(40, 30)]), false);
  });
});

describe('sessionHasClearShortfall', () => {
  it('true when any exercise is clearly below', () => {
    assert.equal(sessionHasClearShortfall([item([12, 12]), item([5, 6])]), true);
  });

  it('false for a solid session', () => {
    assert.equal(sessionHasClearShortfall([item([10, 11, 12])]), false);
  });

  it('prefilled open sets do not trigger it', () => {
    assert.equal(sessionHasClearShortfall([item([0, 0], {}, false)]), false);
  });
});

describe('shortfall reasons', () => {
  it('normalize keeps known values once, in chip order', () => {
    assert.deepEqual(
      normalizeShortfallReasons(['too_hard', 'pain', 'x', 'pain']),
      ['pain', 'too_hard'],
    );
    assert.deepEqual(normalizeShortfallReasons(null), []);
  });

  it('toggle adds and removes', () => {
    assert.deepEqual(toggleShortfallReason([], 'tired'), ['tired']);
    assert.deepEqual(toggleShortfallReason(['tired', 'pain'], 'tired'), ['pain']);
  });

  it('shortfallReasonsToSave: only with a clear shortfall, null when empty', () => {
    const weak = [item([5, 6])];
    assert.deepEqual(shortfallReasonsToSave(weak, ['too_hard']), ['too_hard']);
    assert.equal(shortfallReasonsToSave(weak, []), null);
    assert.equal(shortfallReasonsToSave(weak, undefined), null);
    assert.equal(shortfallReasonsToSave([item([12, 12])], ['tired']), null);
  });
});

describe('isTooHardStreak', () => {
  const weak = [set(5), set(6)];

  it('too_hard in this and the previous session, both clearly below → true', () => {
    assert.equal(
      isTooHardStreak(reps, [unit('s2', weak, ['too_hard']), unit('s1', weak, ['tired', 'too_hard'])]),
      true,
    );
  });

  it('only once → false', () => {
    assert.equal(isTooHardStreak(reps, [unit('s2', weak, ['too_hard'])]), false);
    assert.equal(
      isTooHardStreak(reps, [unit('s2', weak, ['too_hard']), unit('s1', weak, ['tired'])]),
      false,
    );
  });

  it('a session in between without too_hard breaks the streak', () => {
    assert.equal(
      isTooHardStreak(reps, [
        unit('s3', weak, ['too_hard']),
        unit('s2', weak, null),
        unit('s1', weak, ['too_hard']),
      ]),
      false,
    );
  });

  it('too_hard on a session where this exercise went fine does not count', () => {
    assert.equal(
      isTooHardStreak(reps, [unit('s2', weak, ['too_hard']), unit('s1', [set(12), set(12)], ['too_hard'])]),
      false,
    );
  });
});
