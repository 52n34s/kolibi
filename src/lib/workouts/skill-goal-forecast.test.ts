import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeSkillGoalForecast,
  isSamePeriodEdge,
  monthPart,
  rungPosition,
  rungRange,
  skillGoalPeriod,
  skillGoalPoints,
  skillGoalRungs,
  suggestedGoalExerciseIds,
  SKILL_GOAL_MIN_SESSIONS,
  type SkillGoalExercise,
  type SkillGoalUnit,
} from './skill-goal-forecast.ts';
import type { SessionSet } from './types.ts';

const TODAY = '2026-09-25';

function ex(partial: Partial<SkillGoalExercise> & Pick<SkillGoalExercise, 'id'>): SkillGoalExercise {
  return {
    kind: 'reps',
    perSide: false,
    ladderKey: null,
    ladderStep: null,
    userId: null,
    archivedAt: null,
    defaultReps: 8,
    defaultRepsMax: 12,
    defaultSeconds: null,
    defaultSecondsMax: null,
    timeCapSeconds: null,
    ...partial,
  };
}

// pull_vertical excerpt: negative (1) → pull-up (2) → archer (3)
const NEGATIVE = ex({ id: 'neg', ladderKey: 'pull', ladderStep: 1, defaultReps: 3, defaultRepsMax: 6 });
const PULL_UP = ex({ id: 'pull', ladderKey: 'pull', ladderStep: 2, defaultReps: 3, defaultRepsMax: 8 });
const ARCHER = ex({ id: 'archer', ladderKey: 'pull', ladderStep: 3, defaultReps: 2, defaultRepsMax: 5, perSide: true });
const L_SIT = ex({
  id: 'lsit',
  kind: 'time',
  ladderKey: 'lsit',
  ladderStep: 1,
  defaultReps: null,
  defaultRepsMax: null,
  defaultSeconds: 10,
  defaultSecondsMax: 20,
  timeCapSeconds: 30,
});
const FULL_L_SIT = ex({
  id: 'fulllsit',
  kind: 'time',
  ladderKey: 'lsit',
  ladderStep: 2,
  defaultReps: null,
  defaultRepsMax: null,
  defaultSeconds: 5,
  defaultSecondsMax: 15,
  timeCapSeconds: 30,
});
const OWN = ex({ id: 'own', userId: 'u1', defaultReps: 10, defaultRepsMax: null });
const EXERCISES = [NEGATIVE, PULL_UP, ARCHER, L_SIT, FULL_L_SIT, OWN];

let setId = 0;
function set(exerciseId: string, value: number, kind: 'reps' | 'time' = 'reps'): SessionSet {
  setId += 1;
  return {
    id: `set${setId}`,
    sessionId: 's',
    userId: 'u1',
    exerciseId,
    // Deliberately the same stored name everywhere: grouping is by id.
    exerciseName: 'Klimmzug',
    exercisePosition: 0,
    setIndex: 0,
    kind,
    perSide: false,
    targetReps: null,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: kind === 'reps' ? 10 : null,
    reps: kind === 'time' ? null : value,
    seconds: kind === 'time' ? value : null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: '2026-09-01T10:00:00.000Z',
  };
}

function daysAgo(n: number): string {
  const [y, m, d] = TODAY.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() - n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function unit(n: number, ...sets: SessionSet[]): SkillGoalUnit {
  return { loggedOn: daysAgo(n), sets };
}

describe('rungRange', () => {
  it('uses the rep range for reps and the time cap for holds', () => {
    assert.deepEqual(rungRange(PULL_UP), { entry: 3, exit: 8 });
    assert.deepEqual(rungRange(L_SIT), { entry: 10, exit: 30 });
  });

  it('falls back to entry + bonus without an upper bound', () => {
    assert.deepEqual(rungRange(OWN), { entry: 10, exit: 12 });
  });
});

describe('skillGoalRungs', () => {
  it('lists the ladder up to the goal rung and ends the goal rung at the target', () => {
    const rungs = skillGoalRungs('archer', 10, EXERCISES)!;
    assert.deepEqual(
      rungs.map((r) => [r.exerciseId, r.from, r.to]),
      [
        ['neg', 3, 6],
        ['pull', 3, 8],
        ['archer', 2, 10],
      ],
    );
  });

  it('ignores rungs above the goal', () => {
    const rungs = skillGoalRungs('pull', 15, EXERCISES)!;
    assert.deepEqual(rungs.map((r) => r.exerciseId), ['neg', 'pull']);
  });

  it('uses 0 … target off-ladder', () => {
    assert.deepEqual(skillGoalRungs('own', 20, EXERCISES), [
      { exerciseId: 'own', step: null, kind: 'reps', from: 0, to: 20 },
    ]);
  });

  it('is null for an unknown exercise or a non-positive target', () => {
    assert.equal(skillGoalRungs('missing', 10, EXERCISES), null);
    assert.equal(skillGoalRungs('pull', 0, EXERCISES), null);
  });
});

describe('rungPosition — ladder conversion', () => {
  const rungs = skillGoalRungs('archer', 10, EXERCISES)!;

  it('is continuous across a level-up (exit of one rung = entry of the next)', () => {
    assert.equal(rungPosition(rungs, 1, 8), 2);
    assert.equal(rungPosition(rungs, 2, 2), 2);
  });

  it('caps a lower rung at its exit and floors every rung at its entry', () => {
    assert.equal(rungPosition(rungs, 0, 20), 1);
    assert.equal(rungPosition(rungs, 1, 1), 1);
  });

  it('reaches the goal position exactly at the target', () => {
    assert.equal(rungPosition(rungs, 2, 10), 3);
    assert.equal(rungPosition(rungs, 2, 6), 2.5);
  });
});

describe('skillGoalPoints', () => {
  it('takes the highest position per session, grouped by exercise_id', () => {
    const rungs = skillGoalRungs('archer', 10, EXERCISES)!;
    const points = skillGoalPoints(rungs, [
      unit(1, set('pull', 8), set('archer', 3), set('unrelated', 50)),
      unit(3, set('pull', 5)),
    ]);
    assert.equal(points.length, 2);
    assert.equal(points[0]!.exerciseId, 'pull');
    assert.equal(points[1]!.exerciseId, 'archer');
    assert.equal(points[1]!.value, 3);
  });

  it('orders two units of the same day by start, newest-first input or not', () => {
    const rungs = skillGoalRungs('archer', 10, EXERCISES)!;
    // As fetched: newest first. Evening pull-ups after morning negatives.
    const evening = { ...unit(0, set('pull', 6)), startedAt: `${TODAY}T18:30:00.000Z` };
    const morning = { ...unit(0, set('neg', 6)), startedAt: `${TODAY}T08:00:00.000Z` };
    const points = skillGoalPoints(rungs, [evening, morning]);
    assert.deepEqual(
      points.map((point) => point.exerciseId),
      ['neg', 'pull'],
    );
    const forecast = computeSkillGoalForecast({
      goalExerciseId: 'archer',
      targetValue: 10,
      exercises: EXERCISES,
      units: [evening, morning],
      todayKey: TODAY,
    });
    assert.equal(forecast?.current?.exerciseId, 'pull');
  });
});

describe('computeSkillGoalForecast', () => {
  it('gives a hint instead of a date below the minimum number of sessions', () => {
    const result = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units: [unit(20, set('pull', 4)), unit(10, set('pull', 5)), unit(1, set('pull', 6))],
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'too_little_data');
    if (result.status === 'too_little_data') {
      assert.equal(result.sessionsNeeded, SKILL_GOAL_MIN_SESSIONS - 3);
    }
  });

  it('gives a hint when the sessions span fewer than 14 days', () => {
    const result = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units: [0, 3, 6, 9, 12].map((n, i) => unit(n, set('pull', 8 - i))),
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'too_little_data');
    if (result.status === 'too_little_data') {
      assert.equal(result.sessionsNeeded, 0);
      assert.equal(result.daysNeeded, 2);
    }
  });

  it('ignores sessions older than the lookback window for the rate', () => {
    const result = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units: [unit(120, set('pull', 3)), unit(100, set('pull', 4)), unit(80, set('pull', 5)), unit(2, set('pull', 6))],
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'too_little_data');
    assert.equal(result.sessionsInWindow, 1);
  });

  it('forecasts a period from a steady gain on the goal exercise', () => {
    // Off-ladder: 10 → 16 reps over 5 weeks, +1.2 reps/week; target 20.
    const units = [35, 28, 21, 14, 7, 0].map((n, i) => unit(n, set('own', 10 + i * 1.2)));
    const result = computeSkillGoalForecast({
      goalExerciseId: 'own',
      targetValue: 20,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      // 4 reps left at 1.2 per week ≈ 23 days.
      assert.ok(Math.abs(result.daysRemaining - 23) <= 1, String(result.daysRemaining));
      assert.equal(result.etaKey, '2026-10-18');
      assert.deepEqual(result.period.from, { part: 'mid', month: 9, year: 2026 });
      assert.deepEqual(result.period.to, { part: 'late', month: 9, year: 2026 });
      assert.equal(result.progress, 0.8);
    }
  });

  it('counts progress on a lower rung toward a higher-rung target', () => {
    // Pull-ups 3 → 8 across 5 weeks, then the first archer session.
    const units = [
      unit(35, set('pull', 3)),
      unit(28, set('pull', 4)),
      unit(21, set('pull', 5)),
      unit(14, set('pull', 6)),
      unit(7, set('pull', 7)),
      unit(0, set('pull', 8), set('archer', 2)),
    ];
    const result = computeSkillGoalForecast({
      goalExerciseId: 'archer',
      targetValue: 10,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      // 1 rung per 5 weeks → the archer rung (one unit) takes ~35 days.
      assert.ok(Math.abs(result.daysRemaining - 35) <= 1, String(result.daysRemaining));
      assert.deepEqual(result.current, {
        exerciseId: 'archer',
        value: 2,
        step: 3,
        dateKey: TODAY,
      });
      assert.ok(Math.abs(result.progress - 2 / 3) < 1e-9);
    }
  });

  it('does not read a level-up as a drop in the trend', () => {
    // Same pace as above; the reps fall at the level-up but the position does not.
    const units = [
      unit(35, set('neg', 3)),
      unit(28, set('neg', 4.5)),
      unit(21, set('neg', 6)),
      unit(14, set('pull', 3)),
      unit(7, set('pull', 5.5)),
      unit(0, set('pull', 8)),
    ];
    const result = computeSkillGoalForecast({
      goalExerciseId: 'archer',
      targetValue: 10,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'ok');
  });

  it('handles holds in seconds', () => {
    const units = [28, 21, 14, 7, 0].map((n, i) => unit(n, set('lsit', 10 + i * 5, 'time')));
    const result = computeSkillGoalForecast({
      goalExerciseId: 'fulllsit',
      targetValue: 30,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'ok');
  });

  it('gives no date for a flat trend', () => {
    const units = [28, 21, 14, 7, 0].map((n) => unit(n, set('pull', 5)));
    const result = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'no_trend');
  });

  it('says "more than a year" for a very slow trend', () => {
    // +0.6 reps/week toward 100: ~150 weeks.
    const units = [49, 42, 35, 28, 21, 14, 7, 0].map((n, i) => unit(n, set('own', 10 + i * 0.6)));
    const result = computeSkillGoalForecast({
      goalExerciseId: 'own',
      targetValue: 100,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'beyond_year');
  });

  it('marks the goal achieved once a set since the goal start reaches the target', () => {
    const units = [unit(10, set('pull', 12)), unit(1, set('pull', 9))];
    const before = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
      sinceKey: daysAgo(5),
    })!;
    assert.notEqual(before.status, 'achieved');
    const after = computeSkillGoalForecast({
      goalExerciseId: 'pull',
      targetValue: 12,
      exercises: EXERCISES,
      units,
      todayKey: TODAY,
      sinceKey: daysAgo(20),
    })!;
    assert.equal(after.status, 'achieved');
    assert.equal(after.progress, 1);
  });

  it('has no current value and zero progress without sessions', () => {
    const result = computeSkillGoalForecast({
      goalExerciseId: 'archer',
      targetValue: 10,
      exercises: EXERCISES,
      units: [],
      todayKey: TODAY,
    })!;
    assert.equal(result.status, 'too_little_data');
    assert.equal(result.current, null);
    assert.equal(result.progress, 0);
  });
});

describe('skillGoalPeriod', () => {
  it('maps the band to month thirds', () => {
    assert.equal(monthPart(10), 'early');
    assert.equal(monthPart(11), 'mid');
    assert.equal(monthPart(21), 'late');
    // 55 days from 25 Sep → 19 Nov; band ±11 days → 8 Nov … 30 Nov.
    const period = skillGoalPeriod(TODAY, 55);
    assert.deepEqual(period.from, { part: 'early', month: 10, year: 2026 });
    assert.deepEqual(period.to, { part: 'late', month: 10, year: 2026 });
  });

  it('spans months and years', () => {
    const period = skillGoalPeriod('2026-12-01', 30);
    assert.deepEqual(period.from, { part: 'late', month: 11, year: 2026 });
    assert.deepEqual(period.to, { part: 'early', month: 0, year: 2027 });
    assert.equal(isSamePeriodEdge(period.from, period.to), false);
  });

  it('never starts before tomorrow', () => {
    const period = skillGoalPeriod('2026-09-05', 7);
    assert.deepEqual(period.from, { part: 'early', month: 8, year: 2026 });
  });
});

describe('suggestedGoalExerciseIds', () => {
  it('offers recent exercises plus the higher rungs of their ladders', () => {
    assert.deepEqual(suggestedGoalExerciseIds(['pull', 'own', 'archer'], EXERCISES), [
      'pull',
      'archer',
      'own',
    ]);
  });
});
