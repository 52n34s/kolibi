import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  archiveUnit,
  copyInputFromUnit,
  createUnitFromTemplate,
  removeTemplate,
  renameTemplate,
  restoreUnit,
  saveAsTemplate,
  type UnitTemplateBackend,
} from './unit-templates.ts';
import type { SaveTemplateInput } from './workouts-api.ts';
import type { Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

function exercise(id: string): Exercise {
  return {
    id,
    userId: null,
    catalogSlug: id,
    names: { de: id },
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultRepsMax: 12,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: null,
    timeCapSeconds: null,
  } as Exercise;
}

function item(exerciseId: string, position: number, sets: number): TemplateExercise {
  return {
    id: `te-${exerciseId}`,
    exerciseId,
    exercise: exercise(exerciseId),
    position,
    targetSets: sets,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: 90,
  };
}

const push: WorkoutTemplate = {
  id: 'unit-push',
  name: 'Push',
  shortLabel: 'P',
  colorKey: 'violet',
  weekdays: [1, 4],
  position: 2,
  archivedAt: null,
  exercises: [item('dip', 1, 3), item('push_up', 0, 4)],
};

function backend(options: { flagFails?: boolean } = {}) {
  const log: string[] = [];
  const saved: SaveTemplateInput[] = [];
  const api: UnitTemplateBackend = {
    async saveTemplate(input) {
      saved.push(input);
      log.push(`save:${input.id ?? 'new'}`);
      return input.id ?? `copy-${saved.length}`;
    },
    async setTemplateFlag(id, isTemplate) {
      log.push(`flag:${id}:${isTemplate}`);
      if (options.flagFails) {
        throw new Error('column missing');
      }
    },
    async archiveTemplate(id) {
      log.push(`archive:${id}`);
    },
    async restoreTemplate(id) {
      log.push(`restore:${id}`);
    },
  };
  return { api, log, saved };
}

describe('copyInputFromUnit', () => {
  it('copies exercises and targets in order, without the source id or weekdays', () => {
    const input = copyInputFromUnit(push, { position: 5 });
    assert.equal(input.id, null);
    assert.deepEqual(input.weekdays, []);
    assert.equal(input.position, 5);
    assert.deepEqual(
      input.exercises.map((e) => [e.exerciseId, e.targetSets]),
      [
        ['push_up', 4],
        ['dip', 3],
      ],
    );
    assert.equal(input.exercises[0]!.targetRepsMax, 12);
  });
});

describe('saveAsTemplate', () => {
  it('saves an independent copy and flags it as a template', async () => {
    const { api, log, saved } = backend();
    const id = await saveAsTemplate(api, push);
    assert.equal(id, 'copy-1');
    assert.equal(saved[0]!.id, null);
    assert.deepEqual(log, ['save:new', 'flag:copy-1:true']);
  });

  it('archives the copy when the flag cannot be set, so it never shows up as a unit', async () => {
    const { api, log } = backend({ flagFails: true });
    await assert.rejects(saveAsTemplate(api, push));
    assert.deepEqual(log, ['save:new', 'flag:copy-1:true', 'archive:copy-1']);
  });
});

describe('createUnitFromTemplate', () => {
  it('creates a new unit at the given position through the save path', async () => {
    const { api, saved } = backend();
    await createUnitFromTemplate(api, { ...push, id: 'tpl-1' }, 3);
    assert.equal(saved[0]!.id, null);
    assert.equal(saved[0]!.position, 3);
    assert.equal(saved[0]!.exercises.length, 2);
  });
});

describe('archive, restore, rename, remove', () => {
  it('archives and restores by id', async () => {
    const { api, log } = backend();
    await archiveUnit(api, push);
    await restoreUnit(api, push);
    assert.deepEqual(log, ['archive:unit-push', 'restore:unit-push']);
  });

  it('renames in place and keeps the exercises', async () => {
    const { api, saved } = backend();
    await renameTemplate(api, { ...push, id: 'tpl-1' }, 'Push kurz');
    assert.equal(saved[0]!.id, 'tpl-1');
    assert.equal(saved[0]!.name, 'Push kurz');
    assert.equal(saved[0]!.exercises.length, 2);
  });

  it('removes a template by archiving it', async () => {
    const { api, log } = backend();
    await removeTemplate(api, { ...push, id: 'tpl-1' });
    assert.deepEqual(log, ['archive:tpl-1']);
  });
});
