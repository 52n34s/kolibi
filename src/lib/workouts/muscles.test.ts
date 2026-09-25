import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CATALOG_MUSCLES,
  MUSCLE_GROUPS,
  musclesForExercise,
  muscleWeight,
  profileGroups,
  unitMuscleProfile,
} from './muscles.ts';
import type { Exercise, TemplateExercise } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const CATALOG_MIGRATIONS = [
  '20260922102000_seed_exercise_catalog.sql',
  '20260922105000_progression.sql',
  '20260924152000_beginner_ladder_steps.sql',
];

function catalogSlugsFromMigrations(): Set<string> {
  const slugs = new Set<string>();
  for (const file of CATALOG_MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const match of sql.matchAll(/\(\s*'([a-z0-9_]+)',\s*'\{"de"/g)) {
      slugs.add(match[1]!);
    }
    for (const match of sql.matchAll(/catalog_slug = '([a-z0-9_]+)'/g)) {
      slugs.add(match[1]!);
    }
  }
  return slugs;
}

function exercise(partial: Partial<Exercise>): Exercise {
  return {
    id: 'x',
    userId: null,
    catalogSlug: null,
    names: { de: 'x' },
    kind: 'reps',
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultRepsMax: 12,
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
  };
}

function item(ex: Exercise, sets: number): TemplateExercise {
  return {
    id: `te-${ex.id}`,
    exerciseId: ex.id,
    exercise: ex,
    position: 0,
    targetSets: sets,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: null,
  };
}

describe('CATALOG_MUSCLES', () => {
  it('maps every catalog slug seeded in the migrations', () => {
    const slugs = catalogSlugsFromMigrations();
    assert.ok(slugs.size >= 48, `expected ≥48 slugs, found ${slugs.size}`);
    const missing = [...slugs].filter((slug) => !(slug in CATALOG_MUSCLES));
    assert.deepEqual(missing, []);
  });

  it('has only mapped slugs that exist in the catalog', () => {
    const slugs = catalogSlugsFromMigrations();
    const extra = Object.keys(CATALOG_MUSCLES).filter((slug) => !slugs.has(slug));
    assert.deepEqual(extra, []);
  });

  it('gives every exercise at least one primary group and no overlap', () => {
    for (const [slug, mapping] of Object.entries(CATALOG_MUSCLES)) {
      assert.ok(mapping.primary.length >= 1, slug);
      for (const group of [...mapping.primary, ...mapping.secondary]) {
        assert.ok(MUSCLE_GROUPS.includes(group), `${slug}: ${group}`);
      }
      assert.equal(
        mapping.secondary.some((group) => mapping.primary.includes(group)),
        false,
        slug,
      );
    }
  });
});

describe('musclesForExercise', () => {
  it('resolves a slug string and a catalog exercise', () => {
    assert.deepEqual(musclesForExercise('push_up').primary, ['chest']);
    assert.deepEqual(
      musclesForExercise(exercise({ catalogSlug: 'chin_up' })).primary,
      ['back', 'biceps'],
    );
  });

  it('uses the stored selection of own exercises and drops duplicates', () => {
    const own = exercise({
      userId: 'u1',
      primaryMuscles: ['calves', 'calves'],
      secondaryMuscles: ['calves', 'quads'],
    });
    assert.deepEqual(musclesForExercise(own), { primary: ['calves'], secondary: ['quads'] });
  });

  it('returns an empty mapping for unknown input', () => {
    assert.deepEqual(musclesForExercise('unknown'), { primary: [], secondary: [] });
    assert.deepEqual(musclesForExercise(null), { primary: [], secondary: [] });
    assert.deepEqual(musclesForExercise(exercise({ userId: 'u1' })), {
      primary: [],
      secondary: [],
    });
  });

  it('weights primary 1 and secondary 0.5', () => {
    const mapping = musclesForExercise('push_up');
    assert.equal(muscleWeight(mapping, 'chest'), 1);
    assert.equal(muscleWeight(mapping, 'triceps'), 0.5);
    assert.equal(muscleWeight(mapping, 'quads'), 0);
  });
});

describe('unitMuscleProfile', () => {
  it('sums weighted target sets per group', () => {
    const unit = {
      exercises: [
        item(exercise({ id: 'a', catalogSlug: 'push_up' }), 3),
        item(exercise({ id: 'b', catalogSlug: 'bench_dip' }), 2),
      ],
    };
    const profile = unitMuscleProfile(unit);
    assert.equal(profile.chest, 3 + 1);
    assert.equal(profile.triceps, 1.5 + 2);
    assert.equal(profile.shoulders, 1.5 + 1);
    assert.deepEqual(profileGroups(profile), ['chest', 'shoulders', 'triceps']);
  });

  it('prefers the lookup row for own exercises', () => {
    const stale = exercise({ id: 'own', userId: 'u1' });
    const fresh = exercise({ id: 'own', userId: 'u1', primaryMuscles: ['calves'] });
    const profile = unitMuscleProfile({ exercises: [item(stale, 4)] }, (id) =>
      id === 'own' ? fresh : undefined,
    );
    assert.equal(profile.calves, 4);
  });
});
