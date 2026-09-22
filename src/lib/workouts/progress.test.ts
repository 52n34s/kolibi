import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bestSetByExercise,
  personalBests,
  setPerformanceValue,
  targetVsActual,
  volumeBySession,
  volumeByWeek,
} from './progress.ts';
import type { SessionSet, WorkoutSession } from './types.ts';

function set(partial: Partial<SessionSet> & Pick<SessionSet, 'id' | 'kind'>): SessionSet {
  return {
    sessionId: 's1',
    userId: 'u1',
    exerciseId: 'ex1',
    exerciseName: 'Pull-up',
    exercisePosition: 0,
    setIndex: 0,
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

function session(partial: Partial<WorkoutSession> & { id: string; sets: SessionSet[] }): WorkoutSession {
  return {
    userId: 'u1',
    templateId: 't1',
    templateName: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo',
    loggedOn: '2026-09-20',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: '2026-09-20T11:00:00.000Z',
    intensity: 'normal',
    trainingSessionId: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    ...partial,
  };
}

describe('setPerformanceValue', () => {
  it('uses min for perSide time', () => {
    assert.equal(
      setPerformanceValue(
        set({
          kind: 'time',
          perSide: true,
          seconds: 40,
          secondsOtherSide: 35,
        }),
      ),
      35,
    );
  });
});

describe('bestSetByExercise', () => {
  it('takes max reps and max perSide time', () => {
    const bests = bestSetByExercise([
      set({ id: '1', kind: 'reps', reps: 8, exerciseId: 'a', exerciseName: 'A' }),
      set({ id: '2', kind: 'reps', reps: 10, exerciseId: 'a', exerciseName: 'A' }),
      set({
        id: '3',
        kind: 'time',
        perSide: true,
        seconds: 40,
        secondsOtherSide: 30,
        exerciseId: 'b',
        exerciseName: 'B',
      }),
      set({
        id: '4',
        kind: 'time',
        perSide: true,
        seconds: 35,
        secondsOtherSide: 34,
        exerciseId: 'b',
        exerciseName: 'B',
      }),
    ]);
    const byId = Object.fromEntries(bests.map((b) => [b.exerciseId, b.value]));
    assert.equal(byId.a, 10);
    assert.equal(byId.b, 34);
  });
});

describe('personalBests', () => {
  it('ignores first execution and requires improvement', () => {
    const range = [
      set({ id: '1', kind: 'reps', reps: 9, exerciseId: 'a', exerciseName: 'A' }),
      set({ id: '2', kind: 'reps', reps: 12, exerciseId: 'b', exerciseName: 'B' }),
    ];
    const before = new Map([
      ['a', 8],
      // b missing → first execution
    ]);
    const pbs = personalBests(range, before);
    assert.equal(pbs.length, 1);
    assert.equal(pbs[0]!.exerciseId, 'a');
    assert.equal(pbs[0]!.value, 9);
    assert.equal(pbs[0]!.previousValue, 8);
  });
});

describe('volumeBySession / volumeByWeek', () => {
  it('sums reps and seconds separately and groups by week', () => {
    const sessions = [
      session({
        id: 's1',
        loggedOn: '2026-09-22',
        shortLabel: 'A',
        colorKey: 'teal',
        sets: [
          set({ id: '1', kind: 'reps', reps: 10, sessionId: 's1' }),
          set({ id: '2', kind: 'reps', reps: 8, sessionId: 's1' }),
          set({ id: '3', kind: 'time', seconds: 40, sessionId: 's1' }),
        ],
      }),
      session({
        id: 's2',
        loggedOn: '2026-09-15',
        shortLabel: 'B',
        colorKey: 'pink',
        sets: [set({ id: '4', kind: 'reps', reps: 5, sessionId: 's2' })],
      }),
    ];
    const volumes = volumeBySession(sessions);
    assert.equal(volumes[0]!.reps, 18);
    assert.equal(volumes[0]!.seconds, 40);
    const weeks = volumeByWeek(sessions);
    assert.equal(weeks.length, 2);
    // Sep 22 2026 = Tue → week Mon 2026-09-21; Sep 15 = Tue → Mon 2026-09-14
    assert.equal(weeks[0]!.weekStart, '2026-09-21');
    assert.equal(weeks[1]!.weekStart, '2026-09-14');
  });
});

describe('targetVsActual', () => {
  it('uses lower bound × sets', () => {
    const result = targetVsActual(
      session({
        id: 's1',
        sets: [
          set({ id: '1', kind: 'reps', targetReps: 8, reps: 10 }),
          set({ id: '2', kind: 'reps', targetReps: 8, reps: 9 }),
          set({ id: '3', kind: 'time', targetSeconds: 30, seconds: 35 }),
        ],
      }),
    );
    assert.deepEqual(result, {
      targetReps: 16,
      actualReps: 19,
      targetSeconds: 30,
      actualSeconds: 35,
    });
  });
});
