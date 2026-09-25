import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adjustCurrent,
  buildActiveSessionFromTemplate,
  completeCurrentSet,
  addSet,
} from './session-logic.ts';
import { applySetPrefill, lastSetsByExercise, prefillSetValue } from './set-prefill.ts';
import type { ActiveSet, Exercise, SessionSet, WorkoutTemplate } from './types.ts';

let n = 0;
const open = (value: number, extra: Partial<ActiveSet> = {}): ActiveSet => ({
  id: `a${(n += 1)}`,
  value,
  done: false,
  completedAt: null,
  secondsOtherSide: null,
  ...extra,
});
const done = (value: number, at: string, secondsOtherSide: number | null = null): ActiveSet => ({
  ...open(value),
  done: true,
  completedAt: at,
  secondsOtherSide,
});
const reps = (sets: ActiveSet[]) => ({ kind: 'reps' as const, targetReps: 8, targetSeconds: null, sets });

describe('prefillSetValue', () => {
  it('a) a set already done in this session wins (the one completed last)', () => {
    const item = reps([done(10, '2026-09-25T18:02:00Z'), done(9, '2026-09-25T18:05:00Z'), open(8)]);
    assert.deepEqual(prefillSetValue(item, 2, [{ value: 12, secondsOtherSide: null }]), {
      value: 9,
      secondsOtherSide: null,
    });
  });

  it('b) the same set of the last session, else its last set', () => {
    const last = [
      { value: 11, secondsOtherSide: null },
      { value: 10, secondsOtherSide: null },
    ];
    assert.equal(prefillSetValue(reps([open(8), open(8), open(8)]), 1, last).value, 10);
    assert.equal(prefillSetValue(reps([open(8), open(8), open(8)]), 2, last).value, 10);
    assert.equal(prefillSetValue(reps([open(8)]), 0, last).value, 11);
  });

  it('c) the lower bound without anything else', () => {
    assert.deepEqual(prefillSetValue(reps([open(0)]), 0, null), { value: 8, secondsOtherSide: null });
    assert.equal(
      prefillSetValue({ kind: 'time', targetReps: null, targetSeconds: 20, sets: [open(0)] }, 0, []).value,
      20,
    );
  });

  it('per side: both sides are taken over', () => {
    const hold = { kind: 'time' as const, targetReps: null, targetSeconds: 20, sets: [done(30, '2026-09-25T18:00:00Z', 35), open(20)] };
    assert.deepEqual(prefillSetValue(hold, 1, null), { value: 30, secondsOtherSide: 35 });
    assert.deepEqual(
      prefillSetValue({ ...hold, sets: [open(20)] }, 0, [{ value: 25, secondsOtherSide: 28 }]),
      { value: 25, secondsOtherSide: 28 },
    );
  });
});

describe('applySetPrefill', () => {
  it('never overwrites a value the user changed, nor done sets', () => {
    const item = reps([done(12, '2026-09-25T18:00:00Z'), open(9, { edited: true }), open(8)]);
    const next = applySetPrefill(item, null);
    assert.deepEqual(next.sets.map((set) => set.value), [12, 9, 12]);
  });
});

describe('lastSetsByExercise', () => {
  const set = (partial: Partial<SessionSet>): SessionSet => ({
    id: `s${(n += 1)}`,
    sessionId: 'x',
    userId: 'u',
    exerciseId: 'push',
    exerciseName: 'Push',
    exercisePosition: 0,
    setIndex: 0,
    kind: 'reps',
    perSide: false,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    reps: 10,
    seconds: null,
    secondsOtherSide: null,
    weightKg: null,
    completedAt: '2026-09-20T10:00:00Z',
    ...partial,
  });
  const session = (id: string, finishedAt: string | null, sets: SessionSet[]) => ({
    id,
    finishedAt,
    startedAt: '2026-09-01T10:00:00Z',
    loggedOn: '2026-09-01',
    sets,
  });

  it('takes the newest finished session per exercise, in set order', () => {
    const history = lastSetsByExercise([
      session('old', '2026-09-10T10:00:00Z', [set({ reps: 7 })]),
      session('new', '2026-09-20T10:00:00Z', [set({ setIndex: 1, reps: 11 }), set({ setIndex: 0, reps: 12 })]),
      session('open', null, [set({ reps: 20 })]),
      session('plank', '2026-09-15T10:00:00Z', [
        set({ exerciseId: 'side', kind: 'time', reps: null, seconds: 30, secondsOtherSide: 33 }),
      ]),
    ]);
    assert.deepEqual(history.push?.map((s) => s.value), [12, 11]);
    assert.deepEqual(history.side, [{ value: 30, secondsOtherSide: 33 }]);
  });

  it('leaves out the running session', () => {
    const history = lastSetsByExercise([session('now', '2026-09-25T10:00:00Z', [set({ reps: 5 })])], {
      excludeSessionId: 'now',
    });
    assert.deepEqual(history, {});
  });
});

describe('session prefill', () => {
  const exercise = { id: 'push', names: { de: 'Push' }, kind: 'reps', perSide: false } as unknown as Exercise;
  const template: WorkoutTemplate = {
    id: 't',
    name: 'A',
    shortLabel: 'A',
    colorKey: 'indigo',
    weekdays: [],
    position: 0,
    exercises: [
      {
        id: 'te',
        exerciseId: 'push',
        exercise,
        position: 0,
        targetSets: 3,
        targetReps: 8,
        targetRepsMax: 12,
        targetSeconds: null,
        targetSecondsMax: null,
        targetWeightKg: null,
        restSeconds: 60,
      },
    ],
  };

  it('start: last session per set; after a set: its value for untouched open sets', () => {
    let session = buildActiveSessionFromTemplate(template, {
      userId: 'u',
      loggedOn: '2026-09-25',
      lastSetsByExercise: { push: [{ value: 11, secondsOtherSide: null }, { value: 10, secondsOtherSide: null }] },
    });
    assert.deepEqual(session.items[0]!.sets.map((s) => s.value), [11, 10, 10]);

    session = adjustCurrent(session, 1); // 12, user changed
    session = completeCurrentSet(session, '2026-09-25T18:00:00Z')!.session;
    assert.deepEqual(session.items[0]!.sets.map((s) => s.value), [12, 12, 12]);

    session = adjustCurrent(session, -3); // set 2 → 9, changed
    session = addSet(session, 0);
    assert.deepEqual(session.items[0]!.sets.map((s) => s.value), [12, 9, 12, 12]);
  });

  it('without history the lower bound, as before', () => {
    const session = buildActiveSessionFromTemplate(template, { userId: 'u', loggedOn: '2026-09-25' });
    assert.deepEqual(session.items[0]!.sets.map((s) => s.value), [8, 8, 8]);
    assert.equal(session.lastSetsByExercise, undefined);
  });
});
