import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildBackfillSession } from './backfill.ts';
import type { Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

function exercise(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'kind'>): Exercise {
  return {
    userId: null,
    catalogSlug: null,
    names: { de: partial.id },
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultSeconds: null,
    defaultRestSeconds: 60,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ...partial,
  };
}

describe('buildBackfillSession', () => {
  it('marks every set done with lower-bound targets', () => {
    const te: TemplateExercise = {
      id: 'te1',
      exerciseId: 'e1',
      exercise: exercise({ id: 'e1', kind: 'reps' }),
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetRepsMax: 12,
      targetSeconds: null,
      targetSecondsMax: null,
      targetWeightKg: null,
      restSeconds: 60,
    };
    const template: WorkoutTemplate = {
      id: 'tmpl',
      name: 'Push',
      shortLabel: 'P',
      colorKey: 'indigo',
      weekdays: [],
      position: 0,
      exercises: [te],
    };
    const session = buildBackfillSession(template, {
      loggedOn: '2026-09-20',
      durationMinutes: 45,
      intensity: 'normal',
    });
    assert.equal(session.phase, 'summary');
    assert.equal(session.intensity, 'normal');
    assert.equal(session.loggedOn, '2026-09-20');
    assert.ok(session.finishedAt);
    assert.equal(session.items[0]!.sets.length, 3);
    for (const set of session.items[0]!.sets) {
      assert.equal(set.done, true);
      assert.equal(set.value, 8);
      assert.ok(set.completedAt);
    }
  });
});
