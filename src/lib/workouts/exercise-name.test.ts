import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exerciseLabelOrFallback, resolveExerciseName } from './exercise-name.ts';

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
