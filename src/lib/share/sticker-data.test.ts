import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  availableStickerOptions,
  bestSessionSets,
  biggestGain,
  buildExerciseSticker,
  buildLevelSticker,
  buildRecapSticker,
  buildSessionSticker,
  formatGain,
  formatSetsCompact,
  ladderPosition,
  stickerAnalyticsType,
  topSessionExercises,
} from './sticker-data.ts';
import type { Exercise, ProgressionEvent, SessionSet, WorkoutSession } from '../workouts/types.ts';

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
      isNewBest: true,
    });
    assert.equal(sticker.name, 'Push-ups');
    assert.deepEqual(sticker.level, { step: 2, total: 3 });
    assert.equal(formatSetsCompact(sticker.values, sticker.exerciseKind), '12 · 12 · 10');
    assert.equal(sticker.isNewBest, true);
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
      isNewBest: false,
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
      isNewBest: false,
    });
    assert.equal(sticker.name, 'Mein Zirkel');
    assert.equal(sticker.level, null);
    assert.deepEqual(availableStickerOptions(sticker), ['showBest']);
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
      sessions: [
        session('s1', [
          set({ id: '1', reps: 7, completedAt: 'x' }),
          set({ id: '2', reps: 6, setIndex: 1, completedAt: 'y' }),
          set({ id: '3', kind: 'time', exerciseId: 'plank', seconds: 60, completedAt: 'z' }),
        ]),
      ],
      beforeBests: { ex1: 5 },
      events: [event({}), event({ id: 'e2', status: 'declined' }), event({ id: 'e3', kind: 'sets_up' })],
      proteinHitDays: 4,
      nameOf: () => 'Klimmzüge',
    });
    assert.equal(recap.sessions, 1);
    assert.equal(recap.totalReps, 13);
    assert.equal(recap.bestsCount, 1);
    assert.equal(recap.levelsCount, 1);
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 7 });
    assert.equal(stickerAnalyticsType(recap), 'recap_month');
  });

  it('handles a week without sessions and drops the protein line at 0', () => {
    const recap = buildRecapSticker('week', {
      sessions: [],
      beforeBests: {},
      events: [],
      proteinHitDays: 0,
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
      sessions: [
        session('s1', [set({ id: '1', exerciseName: 'Klimmzüge', reps: 6, completedAt: 'a' })]),
        session('s2', [set({ id: '2', exerciseName: 'Pull-ups', reps: 8, completedAt: 'b' })]),
      ],
      beforeBests: { ex1: 5 },
      events: [],
      proteinHitDays: 3,
      nameOf: () => 'Klimmzüge',
    });
    assert.equal(recap.bestsCount, 1);
    assert.deepEqual(recap.biggestGain, { name: 'Klimmzüge', exerciseKind: 'reps', from: 5, to: 8 });
    assert.deepEqual(availableStickerOptions(recap), ['showBiggestGain', 'showProtein']);
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
