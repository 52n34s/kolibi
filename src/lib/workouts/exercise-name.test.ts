import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveExerciseName } from './exercise-name.ts';

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
