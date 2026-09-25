import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activeItemToHistoryUnit } from './progression-history.ts';
import {
  buildActiveSessionFromTemplate,
  completeCurrentSet,
  setCurrentRir,
  toSessionSetUpsert,
} from './session-logic.ts';
import type { ActiveSession, Exercise, ExerciseKind, WorkoutTemplate } from './types.ts';

function exercise(id: string, kind: ExerciseKind): Exercise {
  return {
    id,
    userId: null,
    catalogSlug: null,
    names: { de: id },
    kind,
    perSide: false,
    defaultSets: 2,
    defaultReps: kind === 'time' ? null : 8,
    defaultRepsMax: kind === 'time' ? null : 12,
    defaultSeconds: kind === 'time' ? 30 : null,
    defaultSecondsMax: kind === 'time' ? 45 : null,
    defaultRestSeconds: 60,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'variant',
    timeCapSeconds: null,
  };
}

function session(kind: ExerciseKind): ActiveSession {
  const ex = exercise('e1', kind);
  const template: WorkoutTemplate = {
    id: 'tmpl',
    name: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo',
    weekdays: [1],
    position: 0,
    archivedAt: null,
    exercises: [
      {
        id: 'te1',
        exerciseId: ex.id,
        exercise: ex,
        position: 0,
        targetSets: 2,
        targetReps: ex.defaultReps,
        targetRepsMax: ex.defaultRepsMax,
        targetSeconds: ex.defaultSeconds,
        targetSecondsMax: ex.defaultSecondsMax,
        targetWeightKg: null,
        restSeconds: 60,
      },
    ],
  };
  return buildActiveSessionFromTemplate(template, { userId: 'u1', loggedOn: '2026-09-25' });
}

describe('setCurrentRir', () => {
  it('stores rir on the open set and carries it through completion into the upsert', () => {
    const withRir = setCurrentRir(session('reps'), 2);
    assert.equal(withRir.items[0]!.sets[0]!.rir, 2);
    const done = completeCurrentSet(withRir, '2026-09-25T10:00:00.000Z');
    assert.ok(done);
    assert.equal(toSessionSetUpsert(done!.session, 0, 0)?.rir, 2);
    assert.equal(activeItemToHistoryUnit(done!.session.items[0]!, 's', null).sets[0]!.rir, 2);
  });

  it('null clears; values outside 0–3 are ignored', () => {
    const a = setCurrentRir(session('reps'), 3);
    assert.equal(setCurrentRir(a, null).items[0]!.sets[0]!.rir, null);
    assert.equal(setCurrentRir(a, 4).items[0]!.sets[0]!.rir, 3);
  });

  it('time exercises never get rir', () => {
    const s = setCurrentRir(session('time'), 1);
    assert.equal(s.items[0]!.sets[0]!.rir, undefined);
  });

  it('not tapped → upsert carries null', () => {
    const done = completeCurrentSet(session('reps'), '2026-09-25T10:00:00.000Z');
    assert.equal(toSessionSetUpsert(done!.session, 0, 0)?.rir, null);
  });

  it('a set persisted before rir existed (no field) still maps', () => {
    const legacy = session('reps');
    const set = legacy.items[0]!.sets[0]!;
    delete (set as { rir?: number | null }).rir;
    const done = completeCurrentSet(legacy, '2026-09-25T10:00:00.000Z');
    assert.equal(toSessionSetUpsert(done!.session, 0, 0)?.rir, null);
  });
});
