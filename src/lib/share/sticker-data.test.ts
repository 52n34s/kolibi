import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  availableStickerOptions,
  bestSessionSets,
  biggestGain,
  buildExerciseSticker,
  buildGoalSticker,
  buildLevelSticker,
  buildMealSticker,
  buildProgressSticker,
  buildRecapSticker,
  buildSessionSticker,
  exerciseMilestone,
  formatGain,
  formatSetsCompact,
  ladderPosition,
  nextStoryScale,
  progressCurveLevels,
  risingRungs,
  progressExerciseIds,
  recapWindow,
  stickerAnalyticsType,
  topSessionExercises,
} from './sticker-data.ts';
import type { Exercise, ProgressionEvent, SessionSet, WorkoutSession } from '../workouts/types.ts';
import { computeSkillGoalForecast } from '../workouts/skill-goal-forecast.ts';
const TODAY = '2026-09-24';

function set(partial: Partial<SessionSet> & Pick<SessionSet, 'id'>): SessionSet {
  return {
    sessionId: 's1',
    userId: 'u1',
    exerciseId: 'ex1',
    exerciseName: 'Pull-up',
    exercisePosition: 0,
    setIndex: 0,
    kind: 'reps',
    perSide: false,
    targetReps: 8,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    reps: null,
    seconds: null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: '2026-09-20T10:00:00.000Z',
    ...partial,
  };
}

function session(id: string, sets: SessionSet[]): WorkoutSession {
  return {
    id,
    userId: 'u1',
    templateId: 't1',
    templateName: 'Oberkörper',
    shortLabel: 'A',
    colorKey: 'indigo',
    loggedOn: '2026-09-20',
    startedAt: '2026-09-20T09:30:00.000Z',
    finishedAt: '2026-09-20T10:15:00.000Z',
    intensity: null,
    trainingSessionId: null,
    createdAt: '2026-09-20T09:30:00.000Z',
    sets,
  };
}

function event(partial: Partial<ProgressionEvent>): ProgressionEvent {
  return {
    id: 'e1',
    userId: 'u1',
    templateId: 't1',
    sessionId: null,
    kind: 'variant_up',
    fromExerciseId: 'a',
    toExerciseId: 'b',
    fromTarget: {} as ProgressionEvent['fromTarget'],
    toTarget: {} as ProgressionEvent['toTarget'],
    status: 'accepted',
    createdAt: '2026-09-20T10:15:00.000Z',
    ...partial,
  };
}

type LadderExercise = Pick<
  Exercise,
  'id' | 'names' | 'ladderKey' | 'ladderStep' | 'userId' | 'archivedAt'
>;

function rung(step: number, de: string, en: string): LadderExercise {
  return {
    id: `push-${step}`,
    names: { de, en },
    ladderKey: 'push',
    ladderStep: step,
    userId: null,
    archivedAt: null,
  };
}

const PUSH_LADDER: LadderExercise[] = [
  rung(3, 'Diamant-Liegestütze', 'Diamond push-ups'),
  rung(1, 'Knie-Liegestütze', 'Knee push-ups'),
  rung(2, 'Liegestütze', 'Push-ups'),
  { ...rung(9, 'Eigene', 'Own'), userId: 'u1' },
];

describe('formatSetsCompact', () => {
  it('collapses equal sets', () => {
    assert.equal(formatSetsCompact([8, 8, 8], 'reps'), '3 × 8');
    assert.equal(formatSetsCompact([30, 30, 30], 'time'), '3 × 30 s');
  });

  it('lists mixed sets', () => {
    assert.equal(formatSetsCompact([8, 8, 7], 'reps'), '8 · 8 · 7');
    assert.equal(formatSetsCompact([30, 30, 25], 'time'), '30 · 30 · 25 s');
  });

  it('shows a single set without a multiplier and weighted as reps only', () => {
    assert.equal(formatSetsCompact([12], 'weighted'), '12');
    assert.equal(formatSetsCompact([0, 10, 10], 'weighted'), '2 × 10');
  });

  it('is empty without completed sets', () => {
    assert.equal(formatSetsCompact([], 'reps'), '');
  });
});

describe('ladderPosition', () => {
  it('counts catalog steps of the same ladder only', () => {
    assert.deepEqual(ladderPosition({ ladderKey: 'push', ladderStep: 2 }, PUSH_LADDER), {
      step: 2,
      total: 3,
    });
  });

  it('is null for an own exercise without a ladder', () => {
    assert.equal(ladderPosition({ ladderKey: null, ladderStep: null }, PUSH_LADDER), null);
    assert.equal(ladderPosition({ ladderKey: 'push', ladderStep: 4 }, PUSH_LADDER), null);
  });
});

describe('buildExerciseSticker', () => {
  it('resolves the name in the current language and keeps the level', () => {
    const sticker = buildExerciseSticker({
      exercise: PUSH_LADDER[2],
      fallbackName: 'Liegestütze (alt)',
      lang: 'en',
      exerciseKind: 'reps',
      perSide: false,
      values: [12, 12, 10],
      ladder: PUSH_LADDER,
      milestone: 'newBest',
    });
    assert.equal(sticker.name, 'Push-ups');
    assert.deepEqual(sticker.level, { step: 2, total: 3 });
    assert.equal(formatSetsCompact(sticker.values, sticker.exerciseKind), '12 · 12 · 10');
    assert.equal(sticker.milestone, 'newBest');
  });

  it('keeps per-side time and drops empty sets', () => {
    const sticker = buildExerciseSticker({
      exercise: null,
      fallbackName: 'Seitstütz',
      lang: 'de',
      exerciseKind: 'time',
      perSide: true,
      values: [30, 0, 30],
      ladder: [],
      milestone: null,
    });
    assert.equal(sticker.perSide, true);
    assert.equal(formatSetsCompact(sticker.values, sticker.exerciseKind), '2 × 30 s');
  });

  it('has no level for an own exercise without a ladder', () => {
    const sticker = buildExerciseSticker({
      exercise: { names: { de: 'Mein Zirkel' }, ladderKey: null, ladderStep: null },
      fallbackName: 'x',
      lang: 'en',
      exerciseKind: 'reps',
      perSide: false,
      values: [15],
      ladder: PUSH_LADDER,
      milestone: null,
    });
    assert.equal(sticker.name, 'Mein Zirkel');
    assert.equal(sticker.level, null);
    assert.deepEqual(availableStickerOptions(sticker), ['showBest']);
  });
});

describe('exerciseMilestone', () => {
  it('marks a first execution as first time, not as a personal best', () => {
    assert.equal(exerciseMilestone({ sessionBest: 8, priorBest: null, historyLoaded: true }), 'firstTime');
    const sticker = buildExerciseSticker({
      exercise: null,
      fallbackName: 'Dips',
      lang: 'de',
      exerciseKind: 'reps',
      perSide: false,
      values: [8, 7],
      ladder: [],
      milestone: exerciseMilestone({ sessionBest: 8, priorBest: null, historyLoaded: true }),
    });
    assert.equal(sticker.milestone, 'firstTime');
  });

  it('marks only a beaten earlier best as a personal best', () => {
    assert.equal(exerciseMilestone({ sessionBest: 9, priorBest: 8, historyLoaded: true }), 'newBest');
    assert.equal(exerciseMilestone({ sessionBest: 8, priorBest: 8, historyLoaded: true }), null);
  });

  it('claims nothing while the history loads or without a completed set', () => {
    assert.equal(exerciseMilestone({ sessionBest: 8, priorBest: null, historyLoaded: false }), null);
    assert.equal(exerciseMilestone({ sessionBest: null, priorBest: 5, historyLoaded: true }), null);
  });
});

describe('buildLevelSticker', () => {
  it('names the new and the previous level', () => {
    const sticker = buildLevelSticker({
      toExercise: PUSH_LADDER[0],
      fromExercise: PUSH_LADDER[2],
      lang: 'de',
      ladder: PUSH_LADDER,
    });
    assert.deepEqual(sticker, {
      kind: 'level',
      name: 'Diamant-Liegestütze',
      level: { step: 3, total: 3 },
      previousName: 'Liegestütze',
    });
  });

  it('falls back to the rung below when the source exercise is unknown', () => {
    const sticker = buildLevelSticker({ toExercise: PUSH_LADDER[2], lang: 'en', ladder: PUSH_LADDER });
    assert.equal(sticker?.previousName, 'Knee push-ups');
  });

  it('is null off-ladder', () => {
    assert.equal(
      buildLevelSticker({
        toExercise: { id: 'x', names: { de: 'X' }, ladderKey: null, ladderStep: null },
        lang: 'de',
        ladder: PUSH_LADDER,
      }),
      null,
    );
  });
});

describe('buildSessionSticker', () => {
  it('counts accepted level-ups and merges an exercise done twice', () => {
    const sticker = buildSessionSticker({
      name: ' Oberkörper A ',
      dateKey: '2026-09-24',
      durationMinutes: 47.6,
      totals: { reps: 90, seconds: 60 },
      items: [
        { exerciseId: 'pull', name: 'Klimmzüge', exerciseKind: 'reps', values: [6, 6] },
        { exerciseId: 'push', name: 'Liegestütze', exerciseKind: 'reps', values: [15, 14] },
        { exerciseId: 'pull', name: 'Klimmzüge (Finisher)', exerciseKind: 'reps', values: [8] },
        { exerciseId: 'plank', name: 'Plank', exerciseKind: 'time', values: [60] },
        { exerciseId: 'dips', name: 'Dips', exerciseKind: 'reps', values: [] },
      ],
      bestsCount: 1,
      suggestions: [
        { index: 0, kind: 'variant_up' },
        { index: 1, kind: 'variant_up' },
        { index: 3, kind: 'time_up' },
      ],
      decisions: { 0: 'accept', 1: 'later', 3: 'accept' },
    });
    assert.equal(sticker.name, 'Oberkörper A');
    assert.equal(sticker.durationMinutes, 48);
    assert.equal(sticker.levelsCount, 1);
    assert.deepEqual(sticker.topExercises, [
      { name: 'Liegestütze', exerciseKind: 'reps', best: 15 },
      { name: 'Klimmzüge', exerciseKind: 'reps', best: 8 },
      { name: 'Plank', exerciseKind: 'time', best: 60 },
    ]);
  });
});

describe('bestSessionSets', () => {
  it('returns the sets of the session holding the best, matched by id', () => {
    const sessions = [
      session('s1', [set({ id: '1', setIndex: 0, reps: 6, completedAt: 'a' })]),
      session('s2', [
        set({ id: '3', setIndex: 1, reps: 8, completedAt: 'c', exerciseName: 'Renamed' }),
        set({ id: '2', setIndex: 0, reps: 9, completedAt: 'b' }),
        set({ id: '4', setIndex: 0, exerciseId: 'other', exerciseName: 'Pull-up', reps: 20, completedAt: 'd' }),
      ]),
    ];
    assert.deepEqual(bestSessionSets(sessions, { exerciseId: 'ex1', completedAt: 'b' }), {
      values: [9, 8],
      perSide: false,
    });
  });

  it('reports per-side time', () => {
    const sessions = [
      session('s1', [
        set({ id: '1', kind: 'time', perSide: true, seconds: 30, secondsOtherSide: 28, completedAt: 'a' }),
      ]),
    ];
    assert.deepEqual(bestSessionSets(sessions, { exerciseId: 'ex1', completedAt: 'a' }), {
      values: [28],
      perSide: true,
    });
  });
});

describe('biggestGain', () => {
  it('prefers the larger relative gain over raw seconds', () => {
    const gain = biggestGain([
      { exerciseName: 'Plank', kind: 'time', value: 45, previousValue: 40 },
      { exerciseName: 'Klimmzüge', kind: 'reps', value: 7, previousValue: 5 },
    ]);
    assert.ok(gain);
    assert.equal(formatGain(gain), 'Klimmzüge 5 → 7');
  });

  it('formats time with a unit', () => {
    const gain = biggestGain([{ exerciseName: 'Plank', kind: 'time', value: 45, previousValue: 30 }]);
    assert.ok(gain);
    assert.equal(formatGain(gain), 'Plank 30 → 45 s');
  });
});

describe('buildRecapSticker', () => {
  it('sums reps without time sets and counts only accepted level-ups', () => {
    const recap = buildRecapSticker('month', {
      todayKey: TODAY,
      manualSessions: [],
      workoutSessions: [
        session('s1', [
          set({ id: '1', reps: 7, completedAt: 'x' }),
          set({ id: '2', reps: 6, setIndex: 1, completedAt: 'y' }),
          set({ id: '3', kind: 'time', exerciseId: 'plank', seconds: 60, completedAt: 'z' }),
        ]),
      ],
      beforeBests: { ex1: 5 },
      events: [event({}), event({ id: 'e2', status: 'declined' }), event({ id: 'e3', kind: 'sets_up' })],
      proteinDays: [],
      nameOf: () => 'Klimmzüge',
    });
    assert.equal(recap.totalReps, 13);
    assert.equal(recap.bestsCount, 1);
    assert.equal(recap.levelsCount, 1);
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 7 });
    assert.equal(stickerAnalyticsType(recap), 'recap_month');
  });

  it('handles a week without sessions and drops the protein line at 0', () => {
    const recap = buildRecapSticker('week', {
      todayKey: TODAY,
      workoutSessions: [],
      manualSessions: [],
      beforeBests: {},
      events: [],
      proteinDays: [{ date: TODAY, hit: false }],
      nameOf: (best) => best.exerciseName,
    });
    assert.deepEqual(recap, {
      kind: 'recap',
      period: 'week',
      sessions: 0,
      totalReps: 0,
      bestsCount: 0,
      levelsCount: 0,
      biggestGain: null,
      proteinHitDays: 0,
    });
    assert.equal(stickerAnalyticsType(recap), 'recap_week');
    assert.deepEqual(availableStickerOptions(recap), []);
  });

  it('keeps one entry for the same exercise under two stored names', () => {
    const recap = buildRecapSticker('week', {
      todayKey: TODAY,
      manualSessions: [],
      workoutSessions: [
        session('s1', [set({ id: '1', exerciseName: 'Klimmzüge', reps: 6, completedAt: 'a' })]),
        session('s2', [set({ id: '2', exerciseName: 'Pull-ups', reps: 8, completedAt: 'b' })]),
      ],
      beforeBests: { ex1: 5 },
      events: [],
      proteinDays: [{ date: '2026-09-22', hit: true }],
      nameOf: () => 'Klimmzüge',
    });
    assert.equal(recap.bestsCount, 1);
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 8 });
    assert.deepEqual(availableStickerOptions(recap), ['showBiggestGain', 'showProtein']);
  });
});

describe('recap rolling window', () => {
  // Monday 2026-09-28. "Meine Woche" is Tue 09-22 … Mon 09-28, so Sat and Sun
  // of the previous calendar week count; Mon 09-21 does not.
  const MONDAY = '2026-09-28';
  const at = (key: string, hour = 12) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, hour).toISOString();
  };
  const day = (id: string, loggedOn: string, sets: SessionSet[], trainingSessionId: string | null = null) => ({
    ...session(id, sets),
    loggedOn,
    trainingSessionId,
  });
  const workouts = [
    day('mon', MONDAY, [set({ id: 'a', reps: 6, completedAt: at(MONDAY) })], 'ts-mon'),
    day('sun', '2026-09-27', [set({ id: 'b', reps: 7, completedAt: at('2026-09-27') })]),
    day('sat', '2026-09-26', [set({ id: 'c', exerciseId: 'dips', reps: 10, completedAt: at('2026-09-26') })]),
    day('old', '2026-09-21', [set({ id: 'd', reps: 9, completedAt: at('2026-09-21') })]),
  ];
  const manual = [
    { id: 'ts-mon', loggedOn: MONDAY }, // written by finishing "mon", not a second session
    { id: 'run', loggedOn: '2026-09-24' },
    { id: 'old-run', loggedOn: '2026-09-21' },
  ];
  const events = [
    event({ id: 'in', createdAt: at('2026-09-22', 0) }), // first minutes of the window
    event({ id: 'out', createdAt: at('2026-09-21', 23) }),
  ];
  const proteinDays = [
    { date: '2026-09-21', hit: true },
    { date: '2026-09-22', hit: true },
    { date: '2026-09-25', hit: false },
    { date: MONDAY, hit: true }, // today counts
  ];
  const build = (period: 'week' | 'month') =>
    buildRecapSticker(period, {
      todayKey: MONDAY,
      workoutSessions: workouts,
      manualSessions: manual,
      beforeBests: { ex1: 5, dips: 8 },
      events,
      proteinDays,
      nameOf: (best) => (best.exerciseId === 'ex1' ? 'Klimmzüge' : 'Dips'),
    });

  it('takes the last 7 days including today', () => {
    assert.deepEqual(recapWindow('week', MONDAY), { startKey: '2026-09-22', endKey: MONDAY });
    assert.deepEqual(recapWindow('month', MONDAY), { startKey: '2026-08-30', endKey: MONDAY });
  });

  it('draws every week figure from the same 7 days', () => {
    const recap = build('week');
    assert.equal(recap.sessions, 4); // mon, sun, sat + the unlinked run
    assert.equal(recap.totalReps, 23); // 6 + 7 + 10, not the 9 of 09-21
    assert.equal(recap.bestsCount, 2); // pull-ups 7 > 5, dips 10 > 8
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 7 });
    assert.equal(recap.levelsCount, 1);
    assert.equal(recap.proteinHitDays, 2); // 09-22 and today
  });

  it('draws every month figure from the same 30 days', () => {
    const recap = build('month');
    assert.equal(recap.sessions, 6);
    assert.equal(recap.totalReps, 32);
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 9 });
    assert.equal(recap.levelsCount, 2);
    assert.equal(recap.proteinHitDays, 3);
  });
});

describe('topSessionExercises', () => {
  it('keeps three, reps first', () => {
    const top = topSessionExercises([
      { name: 'Plank', exerciseKind: 'time', best: 60 },
      { name: 'A', exerciseKind: 'reps', best: 8 },
      { name: 'B', exerciseKind: 'weighted', best: 12 },
      { name: 'C', exerciseKind: 'reps', best: 5 },
    ]);
    assert.deepEqual(
      top.map((row) => row.name),
      ['B', 'A', 'C'],
    );
  });
});

describe('buildProgressSticker', () => {
  const TODAY_P = '2026-09-28';
  const ex = (partial: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise => ({
    userId: null,
    catalogSlug: null,
    names: { de: partial.id, en: partial.id },
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultRepsMax: null,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: null,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'reps' as Exercise['progressionKind'],
    timeCapSeconds: null,
    ...partial,
  });
  const EXERCISES: Exercise[] = [
    ex({ id: 'pull', names: { de: 'Klimmzüge', en: 'Pull-ups' } }),
    ex({ id: 'knee', names: { de: 'Knie-Liegestütze', en: 'Knee push-ups' }, ladderKey: 'push', ladderStep: 1 }),
    ex({ id: 'push', names: { de: 'Liegestütze', en: 'Push-ups' }, ladderKey: 'push', ladderStep: 2 }),
    ex({ id: 'diamond', names: { de: 'Diamant-Liegestütze', en: 'Diamond push-ups' }, ladderKey: 'push', ladderStep: 3 }),
    ex({ id: 'plank', names: { de: 'Unterarmstütz', en: 'Plank' }, kind: 'time' }),
    ex({ id: 'side', names: { de: 'Seitstütz', en: 'Side plank' }, kind: 'time', perSide: true }),
  ];
  const unit = (id: string, loggedOn: string, sets: Partial<SessionSet>[]) => ({
    sessionId: id,
    loggedOn,
    sets: sets.map((partial, index) =>
      set({ id: `${id}-${index}`, sessionId: id, setIndex: index, completedAt: `${loggedOn}T10:00:00.000Z`, ...partial }),
    ),
  });
  const build = (exerciseId: string, units: ReturnType<typeof unit>[], lang = 'de') =>
    buildProgressSticker({ exerciseId, exercises: EXERCISES, units, todayKey: TODAY_P, lang });

  it('follows the same exercise over time, best set per session, never the load', () => {
    const sticker = build('pull', [
      unit('u4', '2026-09-25', [{ exerciseId: 'pull', reps: 8 }, { exerciseId: 'pull', reps: 7, weightKg: 20 }]),
      unit('u1', '2026-05-01', [{ exerciseId: 'pull', reps: 4 }]), // before 12 weeks: history reaches back
      unit('u2', '2026-07-20', [{ exerciseId: 'pull', reps: 5, weightKg: 10 }]),
      unit('u3', '2026-09-05', [{ exerciseId: 'pull', reps: 6 }, { exerciseId: 'dips', reps: 20 }]),
    ]);
    assert.equal(sticker.name, 'Klimmzüge');
    assert.equal(sticker.period, '12w'); // longest period with ≥ 3 sessions
    const view = sticker.views['12w']!;
    assert.deepEqual(view.points.map((p) => p.value), [5, 6, 8]);
    assert.equal(view.start.value, 5);
    assert.equal(view.current.value, 8);
    assert.equal(view.levelChanged, false);
    assert.deepEqual(sticker.views.all!.points.map((p) => [p.dateKey, p.value]), [
      ['2026-05-01', 4],
      ['2026-07-20', 5],
      ['2026-09-05', 6],
      ['2026-09-25', 8],
    ]);
    assert.deepEqual(sticker.views['4w']!.points.map((p) => p.value), [6, 8]);
    assert.equal(stickerAnalyticsType(sticker), 'progress');
  });

  it('shows the level when the rung changed instead of comparing reps', () => {
    const units = [
      unit('a', '2026-05-10', [{ exerciseId: 'knee', reps: 12 }]),
      unit('b', '2026-07-10', [{ exerciseId: 'knee', reps: 15 }]),
      unit('c', '2026-08-20', [{ exerciseId: 'knee', reps: 16 }, { exerciseId: 'push', reps: 5 }]),
      unit('d', '2026-09-26', [{ exerciseId: 'push', reps: 8 }]),
    ];
    assert.deepEqual(progressExerciseIds('push', EXERCISES).sort(), ['diamond', 'knee', 'push']);
    const sticker = build('push', units);
    const view = sticker.views[sticker.period]!;
    assert.equal(sticker.period, '12w');
    assert.equal(sticker.name, 'Liegestütze'); // the shared rung
    assert.equal(sticker.ladderTotal, 3);
    assert.equal(view.levelChanged, true);
    assert.deepEqual([view.start.step, view.start.exerciseName], [1, 'Knie-Liegestütze']);
    assert.deepEqual([view.current.step, view.current.exerciseName], [2, 'Liegestütze']);
    // The session with both rungs counts the higher one.
    assert.deepEqual(view.points.map((p) => [p.step, p.value]), [[1, 15], [2, 5], [2, 8]]);
    assert.deepEqual(availableStickerOptions(sticker), ['showLevel']);
  });

  it('F10: title and curve stop at the shared rung, rungs above it are left out', () => {
    const sticker = build('knee', [
      unit('a', '2026-08-10', [{ exerciseId: 'knee', reps: 12 }]),
      unit('b', '2026-08-20', [{ exerciseId: 'knee', reps: 15 }, { exerciseId: 'push', reps: 5 }]),
      unit('c', '2026-09-26', [{ exerciseId: 'diamond', reps: 3 }, { exerciseId: 'knee', reps: 16 }]),
    ]);
    const view = sticker.views[sticker.period]!;
    assert.equal(sticker.name, 'Knie-Liegestütze');
    assert.equal(view.levelChanged, false);
    assert.deepEqual(view.points.map((p) => [p.step, p.value]), [[1, 12], [1, 15], [1, 16]]);
  });

  it('F10: a lower rung after the step up (another unit) is never drawn as a step back', () => {
    const sticker = build('push', [
      unit('a', '2026-08-03', [{ exerciseId: 'knee', reps: 14 }]),
      unit('b', '2026-08-10', [{ exerciseId: 'push', reps: 5 }]),
      unit('c', '2026-08-12', [{ exerciseId: 'knee', reps: 18 }]), // unit B still on the old rung
      unit('d', '2026-09-20', [{ exerciseId: 'push', reps: 7 }]),
    ]);
    const view = sticker.views[sticker.period]!;
    assert.equal(sticker.name, 'Liegestütze');
    assert.deepEqual(view.points.map((p) => [p.step, p.value]), [[1, 14], [2, 5], [2, 7]]);
    const steps = view.points.map((p) => p.step ?? 0);
    assert.ok(steps.every((step, index) => index === 0 || step >= steps[index - 1]));
  });

  it('uses seconds for time exercises', () => {
    const sticker = build('plank', [
      unit('a', '2026-09-01', [{ exerciseId: 'plank', kind: 'time', seconds: 30 }]),
      unit('b', '2026-09-20', [{ exerciseId: 'plank', kind: 'time', seconds: 45 }, { exerciseId: 'plank', kind: 'time', seconds: 40 }]),
    ], 'en');
    assert.equal(sticker.name, 'Plank');
    assert.equal(sticker.exerciseKind, 'time');
    const view = sticker.views[sticker.period]!;
    assert.deepEqual([view.start.value, view.current.value], [30, 45]);
  });

  it('keeps per-side time as the weaker side and flags it', () => {
    const sticker = build('side', [
      unit('a', '2026-09-02', [{ exerciseId: 'side', kind: 'time', perSide: true, seconds: 30, secondsOtherSide: 25 }]),
      unit('b', '2026-09-23', [{ exerciseId: 'side', kind: 'time', perSide: true, seconds: 40, secondsOtherSide: 42 }]),
    ]);
    assert.equal(sticker.perSide, true);
    const view = sticker.views[sticker.period]!;
    assert.deepEqual([view.start.value, view.current.value], [25, 40]);
  });

  it('has no view with fewer than two sessions', () => {
    const sticker = build('pull', [unit('a', '2026-09-20', [{ exerciseId: 'pull', reps: 6 }])]);
    assert.deepEqual(sticker.views, {});
    assert.equal(build('pull', []).name, 'Klimmzüge');
  });

  it('offers only "seit Beginn" when the history is younger than every week period', () => {
    // First session 20 days ago: "4 weeks ago" would claim a start that is younger.
    const sticker = build('pull', [
      unit('a', '2026-09-08', [{ exerciseId: 'pull', reps: 5 }]),
      unit('b', '2026-09-15', [{ exerciseId: 'pull', reps: 6 }]),
      unit('c', '2026-09-27', [{ exerciseId: 'pull', reps: 7 }]),
    ]);
    assert.deepEqual(Object.keys(sticker.views), ['all']);
    assert.equal(sticker.period, 'all');
    assert.deepEqual([sticker.views.all!.start.value, sticker.views.all!.current.value], [5, 7]);
  });
});

describe('risingRungs', () => {
  it('drops points on a lower rung once a higher one was reached', () => {
    assert.deepEqual(
      risingRungs([{ step: 1 }, { step: 2 }, { step: 1 }, { step: 2 }, { step: 3 }]).map((p) => p.step),
      [1, 2, 2, 3],
    );
    assert.deepEqual(risingRungs([{ step: null }, { step: null }]).length, 2);
  });
});

describe('progressCurveLevels', () => {
  const point = (value: number, step: number | null) => ({
    dateKey: '2026-09-01',
    value,
    exerciseId: String(step),
    exerciseName: '',
    step,
  });

  it('follows the best set within one exercise', () => {
    assert.deepEqual(progressCurveLevels([point(5, null), point(10, null), point(7.5, null)]), [0, 1, 0.5]);
  });

  it('puts a higher rung above a lower one even with fewer reps', () => {
    const levels = progressCurveLevels([point(15, 1), point(18, 1), point(5, 2), point(8, 2)]);
    assert.ok(levels[2] > levels[1]);
    assert.ok(levels[3] > levels[2]);
    assert.ok(levels.every((level) => level >= 0 && level <= 1));
  });
});

describe('nextStoryScale', () => {
  it('scales the content toward two thirds of the card', () => {
    // 640 pt card, target 448 pt: content of 224 pt at 1× doubles.
    assert.equal(nextStoryScale({ scale: 1, contentHeight: 224, cardHeight: 640 }), 2);
    assert.equal(nextStoryScale({ scale: 1.5, contentHeight: 448, cardHeight: 640 }), 1.5);
    assert.equal(nextStoryScale({ scale: 1.5, contentHeight: 480, cardHeight: 640 }), 1.4);
  });

  it('stays between 1× and 2×', () => {
    assert.equal(nextStoryScale({ scale: 1, contentHeight: 100, cardHeight: 640 }), 2);
    assert.equal(nextStoryScale({ scale: 1, contentHeight: 600, cardHeight: 640 }), 1);
    assert.equal(nextStoryScale({ scale: 1.2, contentHeight: 0, cardHeight: 640 }), 1.2);
  });
});

describe('buildMealSticker', () => {
  const items = [
    { name: ' Reis ', kcal: 260, proteinG: 5 },
    { name: 'Hähnchen', kcal: 330, proteinG: 38 },
    { name: '', kcal: 20, proteinG: null },
    { name: 'Brokkoli', kcal: 40, proteinG: 3 },
  ];

  it('lists named ingredients by kcal and sums kcal and protein', () => {
    const data = buildMealSticker({ items, portionFactor: 1, photoUri: 'file:///tmp/a.jpg' });
    assert.deepEqual(data.labels, ['Hähnchen', 'Reis', 'Brokkoli']);
    assert.equal(data.kcal, 650);
    assert.equal(data.proteinG, 46);
    assert.equal(data.photoUri, 'file:///tmp/a.jpg');
    assert.equal(stickerAnalyticsType(data), 'meal');
  });

  it('applies the portion factor', () => {
    const data = buildMealSticker({ items, portionFactor: 0.5, photoUri: null });
    assert.equal(data.kcal, 325);
    assert.equal(data.proteinG, 23);
  });

  it('leaves protein out when no ingredient has a value', () => {
    const data = buildMealSticker({
      items: [{ name: 'Apfel', kcal: 80, proteinG: null }],
      portionFactor: 1,
      photoUri: null,
    });
    assert.equal(data.proteinG, null);
    assert.deepEqual(availableStickerOptions(data), []);
  });

  it('shows at most six labels', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `Zutat ${i}`, kcal: 100 - i, proteinG: 1 }));
    assert.equal(buildMealSticker({ items: many, portionFactor: 1, photoUri: null }).labels.length, 6);
  });
});

describe('buildGoalSticker', () => {
  const goalEx = (partial: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise => ({
    userId: null,
    catalogSlug: null,
    names: { de: partial.id, en: partial.id },
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 3,
    defaultRepsMax: 8,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: null,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'variant',
    timeCapSeconds: null,
    ...partial,
  });
  const EXERCISES: Exercise[] = [
    goalEx({ id: 'pull', names: { de: 'Klimmzüge', en: 'Pull-ups' }, ladderKey: 'pv', ladderStep: 1 }),
    goalEx({
      id: 'archer',
      names: { de: 'Archer-Klimmzüge', en: 'Archer Pull-ups' },
      ladderKey: 'pv',
      ladderStep: 2,
      defaultReps: 2,
      defaultRepsMax: 5,
      perSide: true,
    }),
    goalEx({
      id: 'lsit',
      names: { de: 'L-Sit', en: 'L-Sit' },
      kind: 'time',
      defaultReps: null,
      defaultRepsMax: null,
      defaultSeconds: 10,
      defaultSecondsMax: 20,
    }),
  ];
  const TODAY_G = '2026-09-25';
  const unit = (loggedOn: string, sets: Partial<SessionSet>[]) => ({
    loggedOn,
    sets: sets.map((partial, index) => set({ id: `${loggedOn}-${index}`, setIndex: index, ...partial })),
  });
  const weekly = (exerciseId: string, values: number[], kind: 'reps' | 'time' = 'reps') =>
    values.map((value, i) => {
      const date = new Date(2026, 8, 25 - (values.length - 1 - i) * 7);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return unit(
        key,
        kind === 'time'
          ? [{ exerciseId, kind: 'time', seconds: value, reps: null }]
          : [{ exerciseId, reps: value, weightKg: 15 }],
      );
    });
  const build = (exerciseId: string, targetValue: number, units: ReturnType<typeof unit>[], lang = 'de') => {
    const forecast = computeSkillGoalForecast({
      goalExerciseId: exerciseId,
      targetValue,
      exercises: EXERCISES,
      units,
      todayKey: TODAY_G,
    })!;
    return buildGoalSticker({ goal: { exerciseId, targetValue }, forecast, exercises: EXERCISES, lang });
  };

  it('shows exercise, target, current value from a lower rung, bar, level and period', () => {
    const sticker = build('archer', 10, weekly('pull', [3, 4, 5, 6, 7, 8]));
    assert.equal(sticker.kind, 'goal');
    assert.equal(sticker.name, 'Archer-Klimmzüge');
    assert.equal(sticker.target, 10);
    assert.equal(sticker.perSide, true);
    assert.deepEqual(sticker.current, { value: 8, kind: 'reps', name: 'Klimmzüge' });
    assert.equal(sticker.progress, 0.5);
    assert.deepEqual(sticker.level, { step: 2, total: 2 });
    assert.ok(sticker.period != null);
    assert.equal(sticker.achieved, false);
    assert.deepEqual(availableStickerOptions(sticker), ['showLevel']);
    assert.equal(stickerAnalyticsType(sticker), 'goal');
  });

  it('never carries the load, a body weight or a date that is not there', () => {
    const sticker = build('archer', 10, weekly('pull', [5, 6]));
    assert.equal(sticker.period, null);
    const json = JSON.stringify(sticker);
    assert.ok(!json.includes('15'), json);
    assert.ok(!/weight|kg|kcal/i.test(json), json);
  });

  it('drops the rung name on the goal exercise itself and uses seconds for holds', () => {
    const sticker = build('lsit', 30, weekly('lsit', [10, 14, 18], 'time'), 'en');
    assert.equal(sticker.exerciseKind, 'time');
    assert.deepEqual(sticker.current, { value: 18, kind: 'time', name: null });
    assert.equal(sticker.level, null);
    assert.deepEqual(availableStickerOptions(sticker), []);
  });

  it('shows a full bar and no current line once the goal is reached', () => {
    const sticker = build('pull', 8, weekly('pull', [6, 8]));
    assert.equal(sticker.achieved, true);
    assert.equal(sticker.progress, 1);
    assert.equal(sticker.current, null);
    assert.equal(sticker.period, null);
  });
});
