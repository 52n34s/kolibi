import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countMuscleSets,
  inWindow,
  muscleStatus,
  setCounts,
  visibleMuscleGroups,
  weeklySetTarget,
  type MuscleSetInput,
} from './muscle-volume.ts';
import { emptyMuscleProfile, type MuscleGroup } from './muscles.ts';

const EXERCISES: Record<string, { catalogSlug: string | null; primaryMuscles?: MuscleGroup[] }> = {
  pu: { catalogSlug: 'push_up' },
  pull: { catalogSlug: 'pull_up' },
  calf: { catalogSlug: null, primaryMuscles: ['calves'] },
};

const resolve = (id: string) => EXERCISES[id];

function set(exerciseId: string | null, loggedOn: string, extra: Partial<MuscleSetInput> = {}) {
  return { exerciseId, loggedOn, reps: 8, ...extra };
}

describe('weeklySetTarget', () => {
  it('uses 10 for build_muscle and 6 otherwise', () => {
    assert.equal(weeklySetTarget('build_muscle'), 10);
    assert.equal(weeklySetTarget('gain_weight'), 6);
    assert.equal(weeklySetTarget('lose_weight'), 6);
    assert.equal(weeklySetTarget(null), 6);
  });
});

describe('setCounts', () => {
  it('counts rir 0–3 and sets without rir', () => {
    assert.equal(setCounts(set('pu', '2026-09-25', { rir: 0 })), true);
    assert.equal(setCounts(set('pu', '2026-09-25', { rir: 3 })), true);
    assert.equal(setCounts(set('pu', '2026-09-25', { rir: null })), true);
    assert.equal(setCounts(set('pu', '2026-09-25')), true);
    assert.equal(setCounts(set('pu', '2026-09-25', { rir: 4 })), false);
  });

  it('skips sets that are open or empty', () => {
    assert.equal(setCounts(set('pu', '2026-09-25', { done: false })), false);
    assert.equal(setCounts(set('pu', '2026-09-25', { reps: 0, seconds: null })), false);
    assert.equal(setCounts(set('pu', '2026-09-25', { reps: null, seconds: 20 })), true);
    assert.equal(setCounts({ exerciseId: 'pu', loggedOn: '2026-09-25' }), true);
  });
});

describe('inWindow', () => {
  it('covers today and the days before, never the future', () => {
    assert.equal(inWindow('2026-09-25', '2026-09-25', 7), true);
    assert.equal(inWindow('2026-09-19', '2026-09-25', 7), true);
    assert.equal(inWindow('2026-09-18', '2026-09-25', 7), false);
    assert.equal(inWindow('2026-09-26', '2026-09-25', 7), false);
    assert.equal(inWindow('2026-08-27', '2026-09-25', 30), true);
    assert.equal(inWindow('2026-08-26', '2026-09-25', 30), false);
  });

  it('is stable across a DST switch', () => {
    assert.equal(inWindow('2026-10-20', '2026-10-26', 7), true);
    assert.equal(inWindow('2026-10-19', '2026-10-26', 7), false);
  });
});

describe('countMuscleSets', () => {
  const sets = [
    set('pu', '2026-09-25'),
    set('pu', '2026-09-24'),
    set('pu', '2026-09-20', { rir: 5 }),
    set('pull', '2026-09-10'),
    set('calf', '2026-09-22'),
    set(null, '2026-09-25'),
    set('unknown', '2026-09-25'),
  ];

  it('counts primary 1 and secondary 0.5 over 7 days', () => {
    const counts = countMuscleSets({ sets, resolve, todayKey: '2026-09-25', days: 7 });
    assert.equal(counts.chest, 2);
    assert.equal(counts.triceps, 1);
    assert.equal(counts.shoulders, 1);
    assert.equal(counts.back, 0);
    assert.equal(counts.calves, 1);
  });

  it('averages 30 days per week', () => {
    const counts = countMuscleSets({ sets, resolve, todayKey: '2026-09-25', days: 30 });
    assert.equal(counts.chest, (2 * 7) / 30);
    assert.equal(counts.back, 7 / 30);
    assert.equal(counts.biceps, (0.5 * 7) / 30);
  });
});

describe('muscleStatus', () => {
  it('rounds to one decimal and rounds the missing sets up', () => {
    const counts = emptyMuscleProfile();
    counts.chest = 6;
    counts.back = 6.53;
    counts.core = 11;
    const rows = muscleStatus(counts, 10, ['chest', 'back', 'core']);
    assert.deepEqual(rows, [
      { group: 'chest', sets: 6, target: 10, missing: 4, reached: false },
      { group: 'back', sets: 6.5, target: 10, missing: 4, reached: false },
      { group: 'core', sets: 11, target: 10, missing: 0, reached: true },
    ]);
  });
});

describe('visibleMuscleGroups', () => {
  it('hides calves until the user trains or plans them', () => {
    const empty = emptyMuscleProfile();
    assert.equal(visibleMuscleGroups([empty]).includes('calves'), false);
    assert.equal(visibleMuscleGroups([empty]).length, 9);
    const withCalves = { ...empty, calves: 1 };
    assert.equal(visibleMuscleGroups([empty, withCalves]).at(-1), 'calves');
  });
});
