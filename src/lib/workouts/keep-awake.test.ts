import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldKeepScreenAwake } from './keep-awake.ts';

describe('shouldKeepScreenAwake', () => {
  it('keeps the screen on while a session is active', () => {
    assert.equal(shouldKeepScreenAwake({ phase: 'active' }), true);
  });

  it('releases the screen once the summary shows', () => {
    assert.equal(shouldKeepScreenAwake({ phase: 'summary' }), false);
  });

  it('releases the screen without a session (finished, aborted or signed out)', () => {
    assert.equal(shouldKeepScreenAwake(null), false);
  });
});
