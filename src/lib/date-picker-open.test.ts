import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateOnPickerOpen } from './date-picker-open';

describe('dateOnPickerOpen', () => {
  const shown = new Date(1996, 0, 1);

  it('takes the shown date when nothing is chosen yet ("Fertig" without turning)', () => {
    assert.equal(dateOnPickerOpen(null, shown), shown);
    assert.equal(dateOnPickerOpen(undefined, shown), shown);
  });

  it('keeps a date chosen before', () => {
    const chosen = new Date(1990, 5, 15);
    assert.equal(dateOnPickerOpen(chosen, shown), chosen);
  });
});
