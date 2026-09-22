import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suggestShortLabel } from './short-label.ts';

describe('suggestShortLabel', () => {
  it('uses the first letter when free', () => {
    assert.equal(suggestShortLabel('Push', []), 'P');
    assert.equal(suggestShortLabel('Legs', ['P']), 'L');
  });

  it('skips spaces and folds umlauts', () => {
    assert.equal(suggestShortLabel('  Oberkörper  ', []), 'O');
    assert.equal(suggestShortLabel('Übung', []), 'U');
    assert.equal(suggestShortLabel('Ärmel', ['A']), 'Ar');
  });

  it('ignores emoji and punctuation', () => {
    assert.equal(suggestShortLabel('💪 Push!', []), 'P');
  });

  it('suggests nothing when there is no letter to derive one from', () => {
    // The editor puts this straight into the field; an invented 'X' then got
    // saved as the unit's short label.
    assert.equal(suggestShortLabel('', []), '');
    assert.equal(suggestShortLabel('   ', ['P', 'Pl']), '');
    assert.equal(suggestShortLabel('🔥', []), '');
    assert.equal(suggestShortLabel('123 !?', []), '');
  });

  it('appends the next consonant when the first letter is taken', () => {
    assert.equal(suggestShortLabel('Push', ['P']), 'Ps');
    assert.equal(suggestShortLabel('Pull', ['P', 'Ps']), 'Pl');
  });
});
