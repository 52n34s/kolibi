import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  displayActiveExerciseName,
  displayExerciseName,
  exerciseLabelOrFallback,
  isCatalogExercise,
  resolveExerciseName,
} from './exercise-name.ts';

describe('resolveExerciseName', () => {
  it('prefers the requested language', () => {
    assert.equal(
      resolveExerciseName({ names: { de: 'Klimmzüge', en: 'Pull-ups', es: 'Dominadas' } }, 'en'),
      'Pull-ups',
    );
  });

  it('falls back to de then en then first value', () => {
    assert.equal(resolveExerciseName({ names: { de: 'Klimmzüge', en: 'Pull-ups' } }, 'fr'), 'Klimmzüge');
    assert.equal(resolveExerciseName({ names: { en: 'Pull-ups' } }, 'fr'), 'Pull-ups');
    assert.equal(resolveExerciseName({ names: { es: 'Dominadas' } }, 'fr'), 'Dominadas');
  });

  it('returns empty string when names are empty', () => {
    assert.equal(resolveExerciseName({ names: {} }, 'de'), '');
  });
});

describe('isCatalogExercise / displayExerciseName', () => {
  it('resolves catalog names in the current language', () => {
    const catalog = {
      userId: null,
      catalogSlug: 'pull_up',
      names: { de: 'Klimmzüge', en: 'Pull-ups', es: 'Dominadas' },
    };
    assert.equal(isCatalogExercise(catalog), true);
    assert.equal(
      displayExerciseName({
        exerciseId: 'ex1',
        storedName: 'Klimmzüge',
        exercise: catalog,
        lang: 'en',
      }),
      'Pull-ups',
    );
  });

  it('keeps the stored name for custom exercises', () => {
    const custom = {
      userId: 'user-1',
      catalogSlug: null,
      names: { de: 'Meine Übung' },
    };
    assert.equal(isCatalogExercise(custom), false);
    assert.equal(
      displayExerciseName({
        exerciseId: 'ex2',
        storedName: 'Meine Übung',
        exercise: custom,
        lang: 'en',
      }),
      'Meine Übung',
    );
  });

  it('keeps the stored name when exercise_id is missing', () => {
    assert.equal(
      displayExerciseName({
        exerciseId: null,
        storedName: 'Legacy Name',
        exercise: undefined,
        lang: 'en',
      }),
      'Legacy Name',
    );
  });
});

describe('displayActiveExerciseName', () => {
  it('re-resolves catalog names when the language changes', () => {
    const item = {
      name: 'Klimmzüge',
      names: { de: 'Klimmzüge', en: 'Pull-ups', es: 'Dominadas' },
      catalogSlug: 'pull_up',
    };
    assert.equal(displayActiveExerciseName(item, 'en'), 'Pull-ups');
    assert.equal(displayActiveExerciseName(item, 'es'), 'Dominadas');
  });

  it('keeps the snapshot name for custom exercises', () => {
    assert.equal(
      displayActiveExerciseName(
        { name: 'Eigen', names: { de: 'Eigen' }, catalogSlug: null },
        'en',
      ),
      'Eigen',
    );
  });
});

describe('exerciseLabelOrFallback', () => {
  it('uses the resolved name when the exercise is loaded', () => {
    assert.equal(
      exerciseLabelOrFallback({ names: { de: 'Klimmzüge' } }, 'de', 'Übung'),
      'Klimmzüge',
    );
  });

  /** The export bug: a variant_up leaves the old exercise outside the plan. */
  it('never prints an id when the exercise could not be loaded', () => {
    assert.equal(exerciseLabelOrFallback(null, 'de', 'Übung'), 'Übung');
    assert.equal(exerciseLabelOrFallback(undefined, 'de', 'Übung'), 'Übung');
  });

  it('falls back when the name is empty or blank', () => {
    assert.equal(exerciseLabelOrFallback({ names: {} }, 'de', 'Übung'), 'Übung');
    assert.equal(exerciseLabelOrFallback({ names: { de: '   ' } }, 'de', 'Übung'), 'Übung');
  });
});
