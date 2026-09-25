import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currentRungs,
  exerciseForMuscle,
  isDayBeforeSameMuscles,
  planUnitAdoption,
  recommendForMuscles,
} from './muscle-recommendation.ts';
import type { MuscleStatus } from './muscle-volume.ts';
import type { Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

function ex(
  slug: string,
  ladderKey: string | null,
  ladderStep: number | null,
  kind: 'reps' | 'time' = 'reps',
): Exercise {
  return {
    id: `id-${slug}`,
    userId: null,
    catalogSlug: slug,
    names: { de: slug },
    kind,
    perSide: false,
    defaultSets: 3,
    defaultReps: kind === 'time' ? null : 8,
    defaultRepsMax: kind === 'time' ? null : 12,
    defaultSeconds: kind === 'time' ? 20 : null,
    defaultSecondsMax: kind === 'time' ? 40 : null,
    defaultRestSeconds: 60,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey,
    ladderStep,
    progressionKind: 'variant',
    timeCapSeconds: null,
  };
}

const CATALOG: Exercise[] = [
  ex('wall_push_up', 'push_horizontal', 1),
  ex('incline_push_up', 'push_horizontal', 2),
  ex('push_up', 'push_horizontal', 3),
  ex('parallette_push_up', 'push_horizontal', 4),
  ex('archer_push_up', 'push_horizontal', 5),
  ex('bench_dip', 'dip', 2),
  ex('parallel_bar_dip', 'dip', 3),
  ex('dead_hang', 'pull_vertical', 1, 'time'),
  ex('pull_up', 'pull_vertical', 5),
  ex('inverted_row_bent_knees', 'row', 1),
  ex('box_squat', 'squat_single', 1),
  ex('glute_bridge', 'bridge', 1),
  ex('backpack_curl', null, null),
  ex('chin_up', 'pull_vertical', 4),
];
const bySlug = (slug: string) => CATALOG.find((row) => row.catalogSlug === slug)!;

function te(slug: string, position: number, sets: number): TemplateExercise {
  const exercise = bySlug(slug);
  return {
    id: `te-${slug}-${position}`,
    exerciseId: exercise.id,
    exercise,
    position,
    targetSets: sets,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: null,
  };
}

function unit(
  id: string,
  position: number,
  weekdays: number[],
  items: TemplateExercise[],
): WorkoutTemplate {
  return {
    id,
    name: id,
    shortLabel: id.slice(0, 1).toUpperCase(),
    colorKey: 'indigo',
    weekdays,
    position,
    archivedAt: null,
    exercises: items,
  };
}

function status(group: MuscleStatus['group'], sets: number, target = 10): MuscleStatus {
  const missing = Math.max(0, Math.ceil(target - sets));
  return { group, sets, target, missing, reached: missing === 0 };
}

describe('currentRungs', () => {
  it('prefers the rung of an active unit over the most recent set', () => {
    const units = [unit('push', 0, [], [te('parallette_push_up', 0, 3)])];
    const recentSets = [
      { exerciseId: bySlug('push_up').id, completedAt: '2026-09-24T10:00:00Z' },
      { exerciseId: bySlug('pull_up').id, completedAt: '2026-09-23T10:00:00Z' },
      { exerciseId: bySlug('dead_hang').id, completedAt: '2026-09-01T10:00:00Z' },
    ];
    const rungs = currentRungs({ units, recentSets, exercises: CATALOG });
    assert.equal(rungs.get('push_horizontal')?.catalogSlug, 'parallette_push_up');
    assert.equal(rungs.get('pull_vertical')?.catalogSlug, 'pull_up');
  });
});

describe('exerciseForMuscle', () => {
  it('takes the unit exercise that trains the group as primary', () => {
    const units = [unit('push', 0, [], [te('bench_dip', 0, 3), te('archer_push_up', 1, 3)])];
    const pick = exerciseForMuscle('chest', { units, recentSets: [], exercises: CATALOG });
    assert.equal(pick?.catalogSlug, 'archer_push_up');
  });

  it('uses the current rung of a recently trained ladder', () => {
    const recentSets = [
      { exerciseId: bySlug('incline_push_up').id, completedAt: '2026-09-10T10:00:00Z' },
      { exerciseId: bySlug('push_up').id, completedAt: '2026-09-20T10:00:00Z' },
    ];
    const pick = exerciseForMuscle('chest', { units: [], recentSets, exercises: CATALOG });
    assert.equal(pick?.catalogSlug, 'push_up');
  });

  it('falls back to the lowest catalog rung, reps before holds', () => {
    const ctx = { units: [], recentSets: [], exercises: CATALOG };
    assert.equal(exerciseForMuscle('chest', ctx)?.catalogSlug, 'wall_push_up');
    assert.equal(exerciseForMuscle('back', ctx)?.catalogSlug, 'inverted_row_bent_knees');
    assert.equal(exerciseForMuscle('biceps', ctx)?.catalogSlug, 'backpack_curl');
    assert.equal(exerciseForMuscle('hamstrings', ctx), null);
  });

  it('uses own exercises with a stored primary group', () => {
    const own: Exercise = {
      ...ex('x', null, null),
      id: 'own-calf',
      userId: 'u1',
      catalogSlug: null,
      primaryMuscles: ['calves'],
    };
    const recentSets = [{ exerciseId: own.id, completedAt: '2026-09-20T10:00:00Z' }];
    const pick = exerciseForMuscle('calves', {
      units: [],
      recentSets,
      exercises: [...CATALOG, own],
    });
    assert.equal(pick?.id, 'own-calf');
  });
});

describe('recommendForMuscles', () => {
  it('recommends the missing sets for every group below target', () => {
    const units = [unit('push', 0, [], [te('archer_push_up', 0, 3)])];
    const recs = recommendForMuscles(
      [status('chest', 6), status('core', 12), status('hamstrings', 2)],
      { units, recentSets: [], exercises: CATALOG },
    );
    assert.equal(recs.length, 1);
    assert.equal(recs[0]!.group, 'chest');
    assert.equal(recs[0]!.setsToAdd, 4);
    assert.equal(recs[0]!.exercise.catalogSlug, 'archer_push_up');
  });
});

describe('isDayBeforeSameMuscles', () => {
  it('flags a unit the day before a unit with the same group', () => {
    const push = unit('push', 0, [1], [te('push_up', 0, 3)]);
    const push2 = unit('push2', 1, [2], [te('parallel_bar_dip', 0, 3)]);
    const legs = unit('legs', 2, [7], [te('box_squat', 0, 3)]);
    const units = [push, push2, legs];
    assert.equal(isDayBeforeSameMuscles(push, units, 'chest'), true);
    assert.equal(isDayBeforeSameMuscles(push2, units, 'chest'), false);
    // Sunday → Monday wraps around the week.
    assert.equal(isDayBeforeSameMuscles(legs, units, 'chest'), true);
    assert.equal(isDayBeforeSameMuscles(legs, units, 'quads'), false);
  });

  it('ignores units without weekdays', () => {
    const push = unit('push', 0, [], [te('push_up', 0, 3)]);
    assert.equal(isDayBeforeSameMuscles(push, [push], 'chest'), false);
  });
});

describe('planUnitAdoption', () => {
  const rec = { group: 'chest' as const, setsToAdd: 2, exercise: bySlug('archer_push_up') };

  it('adds sets to the best matching unit that already has the exercise', () => {
    const push = unit('push', 0, [], [te('archer_push_up', 0, 3), te('bench_dip', 1, 3)]);
    const legs = unit('legs', 1, [], [te('box_squat', 0, 3)]);
    const plan = planUnitAdoption({ recommendation: rec, units: [legs, push] });
    assert.equal(plan?.unit.id, 'push');
    assert.equal(plan?.fromSets, 3);
    assert.equal(plan?.toSets, 5);
    assert.deepEqual(
      plan?.save.exercises.map((row) => row.targetSets),
      [5, 3],
    );
    assert.equal(plan?.save.id, 'push');
  });

  it('prefers fewer sets when the match is equal', () => {
    const big = unit('big', 0, [], [te('push_up', 0, 5)]);
    const small = unit('small', 1, [], [te('push_up', 0, 3)]);
    const plan = planUnitAdoption({ recommendation: rec, units: [big, small] });
    assert.equal(plan?.unit.id, 'small');
  });

  it('raises the unit rung of the same ladder instead of adding a second rung', () => {
    const push = unit('push', 0, [], [te('push_up', 0, 3)]);
    const plan = planUnitAdoption({ recommendation: rec, units: [push] });
    assert.equal(plan?.exercise.catalogSlug, 'push_up');
    assert.equal(plan?.save.exercises.length, 1);
    assert.equal(plan?.toSets, 5);
  });

  it('adds the exercise with its default targets when the unit lacks it', () => {
    const legs = unit('legs', 0, [], [te('box_squat', 0, 3)]);
    const plan = planUnitAdoption({ recommendation: rec, units: [legs] });
    assert.equal(plan?.fromSets, null);
    assert.equal(plan?.toSets, 2);
    assert.deepEqual(plan?.save.exercises.at(-1), {
      exerciseId: 'id-archer_push_up',
      targetSets: 2,
      targetReps: 8,
      targetRepsMax: 12,
      targetSeconds: null,
      targetSecondsMax: null,
      targetWeightKg: null,
      restSeconds: null,
    });
  });

  it('spreads weekly sets over the sessions of the week', () => {
    const push = unit('push', 0, [1, 4], [te('push_up', 0, 3)]);
    const plan = planUnitAdoption({
      recommendation: { ...rec, setsToAdd: 3 },
      units: [push],
    });
    assert.equal(plan?.toSets, 5);
  });

  it('skips a unit the day before another chest unit', () => {
    const monday = unit('mon', 0, [1], [te('push_up', 0, 3)]);
    const tuesday = unit('tue', 1, [2], [te('push_up', 0, 3), te('box_squat', 1, 3)]);
    const plan = planUnitAdoption({ recommendation: rec, units: [monday, tuesday] });
    assert.equal(plan?.unit.id, 'tue');
  });

  it('returns null when no unit qualifies', () => {
    const daily = unit('daily', 0, [1, 2, 3, 4, 5, 6, 7], [te('push_up', 0, 3)]);
    assert.equal(planUnitAdoption({ recommendation: rec, units: [daily] }), null);
    assert.equal(planUnitAdoption({ recommendation: rec, units: [] }), null);
    const full = unit('full', 0, [], [te('archer_push_up', 0, 20)]);
    assert.equal(planUnitAdoption({ recommendation: rec, units: [full] }), null);
  });
});
