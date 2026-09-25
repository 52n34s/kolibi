import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkinBaseline,
  computeReadiness,
  nutritionShortfallDays,
  performanceDrops,
  rateCheckin,
  sessionLoad,
  sessionMinutes,
  shiftDateKey,
  trainingLoad,
  wellnessScore,
  type CheckinAnswers,
  type DailyCheckin,
  type ReadinessInput,
  type ReadinessNutritionDay,
  type ReadinessSession,
  type ReadinessSet,
} from './readiness.ts';

const TODAY = '2026-09-25';

const NEUTRAL: CheckinAnswers = { sleep: 3, energy: 3, soreness: 3, stress: 3 }; // 12
const GOOD: CheckinAnswers = { sleep: 5, energy: 4, soreness: 2, stress: 2 }; // 17
const LOW: CheckinAnswers = { sleep: 2, energy: 2, soreness: 4, stress: 4 }; // 8

function pastDays(count: number, answers: CheckinAnswers = NEUTRAL): DailyCheckin[] {
  return Array.from({ length: count }, (_, i) => ({
    ...answers,
    date: shiftDateKey(TODAY, -(i + 1)),
  }));
}

function repsSet(exerciseId: string, reps: number, weightKg: number | null = null): ReadinessSet {
  return {
    exerciseId,
    kind: weightKg != null ? 'weighted' : 'reps',
    perSide: false,
    reps,
    seconds: null,
    secondsOtherSide: null,
    weightKg,
  };
}

function session(
  id: string,
  loggedOn: string,
  opts: {
    minutes?: number | null;
    intensity?: ReadinessSession['intensity'];
    sets?: ReadinessSet[];
  } = {},
): ReadinessSession {
  const startedAt = `${loggedOn}T08:00:00.000Z`;
  const finishedAt =
    opts.minutes == null
      ? null
      : new Date(Date.parse(startedAt) + opts.minutes * 60000).toISOString();
  return {
    id,
    loggedOn,
    startedAt,
    finishedAt,
    intensity: opts.intensity ?? 'normal',
    sets: opts.sets ?? [repsSet('squat', 10), repsSet('squat', 10)],
  };
}

function input(partial: Partial<ReadinessInput>): ReadinessInput {
  return {
    todayKey: TODAY,
    checkin: null,
    pastCheckins: [],
    sessions: [],
    ...partial,
  };
}

describe('shiftDateKey', () => {
  it('crosses month ends', () => {
    assert.equal(shiftDateKey('2026-10-01', -1), '2026-09-30');
    assert.equal(shiftDateKey('2026-09-25', 7), '2026-10-02');
  });
});

describe('wellness and rating', () => {
  it('scores sleep + energy + inverted soreness and stress', () => {
    assert.equal(wellnessScore(NEUTRAL), 12);
    assert.equal(wellnessScore(GOOD), 17);
    assert.equal(wellnessScore({ sleep: 5, energy: 5, soreness: 1, stress: 1 }), 20);
  });

  it('rates absolutely without a baseline', () => {
    assert.equal(rateCheckin(GOOD, null), 'good');
    assert.equal(rateCheckin(NEUTRAL, null), 'neutral');
    assert.equal(rateCheckin(LOW, null), 'low');
  });

  it('rates against the own baseline', () => {
    // Baseline 17: a 17 is just an ordinary day for this person.
    assert.equal(rateCheckin(GOOD, 17), 'neutral');
    assert.equal(rateCheckin({ sleep: 5, energy: 5, soreness: 1, stress: 2 }, 17), 'good');
    assert.equal(rateCheckin({ sleep: 4, energy: 3, soreness: 3, stress: 3 }, 17), 'low');
    // Baseline 9: a 12 is a good day.
    assert.equal(rateCheckin(NEUTRAL, 9), 'good');
  });

  it('treats sleep or energy at 1 as a low day', () => {
    assert.equal(rateCheckin({ sleep: 1, energy: 5, soreness: 1, stress: 1 }, null), 'low');
    assert.equal(rateCheckin({ sleep: 5, energy: 1, soreness: 1, stress: 1 }, 10), 'low');
  });

  it('needs 7 earlier check-ins and uses at most the last 14', () => {
    assert.deepEqual(checkinBaseline(pastDays(6), TODAY), { baseline: null, count: 6 });
    assert.equal(checkinBaseline(pastDays(7), TODAY).baseline, 12);
    const old = pastDays(20, GOOD).slice(14); // days 15–20 back
    const recent = pastDays(14); // days 1–14 back
    assert.equal(checkinBaseline([...old, ...recent], TODAY).baseline, 12);
  });

  it('ignores check-ins from today or later for the baseline', () => {
    const entries = [...pastDays(6), { ...GOOD, date: TODAY }];
    assert.equal(checkinBaseline(entries, TODAY).baseline, null);
  });
});

describe('training load', () => {
  it('uses plausible timestamps, else sets × 3 minutes', () => {
    assert.equal(sessionMinutes(session('a', TODAY, { minutes: 60 })), 60);
    assert.equal(sessionMinutes(session('a', TODAY, { minutes: null })), 6);
    assert.equal(sessionMinutes(session('a', TODAY, { minutes: 400 })), 6);
    assert.equal(sessionMinutes(session('a', TODAY, { minutes: 2 })), 6);
  });

  it('weights minutes by intensity', () => {
    assert.equal(sessionLoad(session('a', TODAY, { minutes: 60, intensity: 'easy' })), 180);
    assert.equal(sessionLoad(session('a', TODAY, { minutes: 60, intensity: 'normal' })), 300);
    assert.equal(sessionLoad(session('a', TODAY, { minutes: 60, intensity: 'hard' })), 420);
    assert.equal(sessionLoad(session('a', TODAY, { minutes: 60, intensity: null })), 300);
  });

  it('sums the 3- and 7-day windows including today', () => {
    const sessions = [
      session('a', TODAY, { minutes: 60 }),
      session('b', shiftDateKey(TODAY, -2), { minutes: 60 }),
      session('c', shiftDateKey(TODAY, -3), { minutes: 60 }),
      session('d', shiftDateKey(TODAY, -7), { minutes: 60 }),
    ];
    assert.equal(trainingLoad(sessions, TODAY, 3), 600);
    assert.equal(trainingLoad(sessions, TODAY, 7), 900);
  });
});

describe('performanceDrops', () => {
  function squatSession(id: string, daysAgo: number, reps: number[], weight: number | null = null) {
    return session(id, shiftDateKey(TODAY, -daysAgo), {
      minutes: 40,
      sets: reps.map((r) => repsSet('squat', r, weight)),
    });
  }

  it('flags a mean below 90 % of the three previous sessions', () => {
    const sessions = [
      squatSession('now', 1, [8, 8, 8]),
      squatSession('p1', 3, [10, 10, 10]),
      squatSession('p2', 5, [10, 10, 10]),
      squatSession('p3', 7, [10, 10, 10]),
    ];
    assert.deepEqual(performanceDrops(sessions, TODAY), ['squat']);
  });

  it('accepts a small dip', () => {
    const sessions = [
      squatSession('now', 1, [9, 9, 10]),
      squatSession('p1', 3, [10, 10, 10]),
      squatSession('p2', 5, [10, 10, 10]),
      squatSession('p3', 7, [10, 10, 10]),
    ];
    assert.deepEqual(performanceDrops(sessions, TODAY), []);
  });

  it('needs three earlier sessions with the exercise', () => {
    const sessions = [
      squatSession('now', 1, [5, 5]),
      squatSession('p1', 3, [10, 10]),
      squatSession('p2', 5, [10, 10]),
    ];
    assert.deepEqual(performanceDrops(sessions, TODAY), []);
  });

  it('leaves out heavier weighted sets', () => {
    const sessions = [
      squatSession('now', 1, [6, 6], 60),
      squatSession('p1', 3, [10, 10], 50),
      squatSession('p2', 5, [10, 10], 50),
      squatSession('p3', 7, [10, 10], 50),
    ];
    assert.deepEqual(performanceDrops(sessions, TODAY), []);
  });

  it('ignores a latest session older than 7 days', () => {
    const sessions = [
      squatSession('now', 9, [5, 5]),
      squatSession('p1', 11, [10, 10]),
      squatSession('p2', 13, [10, 10]),
      squatSession('p3', 15, [10, 10]),
    ];
    assert.deepEqual(performanceDrops(sessions, TODAY), []);
  });
});

describe('nutritionShortfallDays', () => {
  function day(daysAgo: number, calories: number | null, protein: number | null): ReadinessNutritionDay {
    return {
      date: shiftDateKey(TODAY, -daysAgo),
      calories,
      calorieTarget: 2000,
      proteinG: protein,
      proteinTargetG: 120,
    };
  }

  it('counts logged days under 80 % kcal / 70 % protein in the 3 days before today', () => {
    const result = nutritionShortfallDays(
      [day(0, 500, 10), day(1, 1500, 80), day(2, 1599, 83), day(3, 1700, 90), day(4, 100, 5)],
      TODAY,
    );
    assert.deepEqual(result, { calorieDays: 2, proteinDays: 2 });
  });

  it('skips days without logged food', () => {
    const result = nutritionShortfallDays([day(1, null, null), day(2, 0, null)], TODAY);
    assert.deepEqual(result, { calorieDays: 0, proteinDays: 0 });
  });
});

describe('computeReadiness', () => {
  it('without check-in and without data stays a neutral normal', () => {
    const result = computeReadiness(input({}));
    assert.equal(result.level, 'normal');
    assert.equal(result.basis, 'none');
    assert.deepEqual(result.signals, []);
    assert.equal(result.message.key, 'checkin.readiness.normal.sentence');
  });

  it('a good check-in with a quiet week is ready', () => {
    const result = computeReadiness(input({ checkin: GOOD }));
    assert.equal(result.level, 'ready');
    assert.equal(result.basis, 'checkin');
    assert.equal(result.learning, true);
    assert.equal(result.message.key, 'checkin.readiness.ready.sentence');
    assert.equal(result.action.key, 'checkin.readiness.ready.action');
  });

  it('stops learning with 7 earlier check-ins and rates relative', () => {
    const result = computeReadiness(input({ checkin: GOOD, pastCheckins: pastDays(7, GOOD) }));
    assert.equal(result.learning, false);
    assert.equal(result.baseline, 17);
    assert.equal(result.checkinRating, 'neutral');
    assert.equal(result.level, 'normal');
  });

  it('a low check-in is gentle and names a short night', () => {
    const result = computeReadiness(input({ checkin: LOW }));
    assert.equal(result.level, 'gentle');
    assert.equal(result.message.key, 'checkin.readiness.reason.sleep.sentence');
  });

  it('one data signal turns ready into normal, two make it gentle', () => {
    const heavy = [
      session('a', TODAY, { minutes: 60, intensity: 'hard' }),
      session('b', shiftDateKey(TODAY, -1), { minutes: 60, intensity: 'hard' }),
      session('c', shiftDateKey(TODAY, -2), { minutes: 60, intensity: 'hard' }),
    ];
    const one = computeReadiness(input({ checkin: GOOD, sessions: heavy }));
    assert.equal(one.level, 'normal');
    assert.deepEqual(one.signals, ['highLoad']);
    assert.equal(one.message.key, 'checkin.readiness.reason.highLoad.sentence');

    const hungry: ReadinessNutritionDay[] = [1, 2].map((daysAgo) => ({
      date: shiftDateKey(TODAY, -daysAgo),
      calories: 1000,
      calorieTarget: 2000,
      proteinG: 100,
      proteinTargetG: 120,
    }));
    const two = computeReadiness(input({ checkin: GOOD, sessions: heavy, nutrition: hungry }));
    assert.equal(two.level, 'gentle');
    assert.deepEqual(two.signals, ['highLoad', 'lowCalories']);
  });

  it('without a check-in rates from data only', () => {
    const recent = [session('a', shiftDateKey(TODAY, -1), { minutes: 45 })];
    const result = computeReadiness(input({ sessions: recent }));
    assert.equal(result.basis, 'data');
    assert.equal(result.level, 'normal');
    assert.equal(result.checkinRating, null);
  });

  it('high soreness without muscle profiles gives the general hint', () => {
    const result = computeReadiness(
      input({ checkin: { sleep: 5, energy: 5, soreness: 4, stress: 1 } }),
    );
    assert.equal(result.level, 'normal');
    assert.ok(result.signals.includes('soreHigh'));
    assert.equal(result.message.key, 'checkin.readiness.sore.general');
    assert.equal(result.alternativeUnitId, null);
  });

  it('high soreness + planned unit on the same muscles suggests another unit', () => {
    const result = computeReadiness(
      input({
        checkin: { sleep: 4, energy: 4, soreness: 5, stress: 2 },
        soreMuscles: ['legs', 'glutes'],
        plannedUnit: { id: 'pl', name: 'Pull & Legs', muscles: ['back', 'legs'] },
        alternativeUnits: [
          { id: 'pl', name: 'Pull & Legs', muscles: ['back', 'legs'] },
          { id: 'legs2', name: 'Legs', muscles: ['legs'] },
          { id: 'push', name: 'Push', muscles: ['chest', 'shoulders'] },
        ],
      }),
    );
    assert.equal(result.level, 'gentle');
    assert.equal(result.alternativeUnitId, 'push');
    assert.equal(result.soreMuscle, 'legs');
    assert.equal(result.message.key, 'checkin.readiness.sore.muscle.legs');
    assert.deepEqual(result.action, {
      key: 'checkin.readiness.sore.swapAction',
      params: { alternative: 'Push', planned: 'Pull & Legs' },
    });
  });

  it('high soreness on other muscles than the planned unit stays normal', () => {
    const result = computeReadiness(
      input({
        checkin: { sleep: 4, energy: 4, soreness: 4, stress: 2 },
        soreMuscles: ['chest'],
        plannedUnit: { id: 'legs', name: 'Legs', muscles: ['legs'] },
        alternativeUnits: [],
      }),
    );
    assert.equal(result.level, 'normal');
    assert.equal(result.alternativeUnitId, null);
  });

  it('ignores an incomplete check-in', () => {
    const result = computeReadiness(
      input({ checkin: { sleep: 3, energy: 0, soreness: 3, stress: 3 } }),
    );
    assert.equal(result.basis, 'none');
  });
});
