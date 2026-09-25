import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { afterProgress, finishOutcome } from './summary-done.ts';

describe('finishOutcome', () => {
  it('saved on success', () => {
    assert.equal(finishOutcome({ ok: true }), 'saved');
  });

  it('a second "Fertig" after the unit was saved is not a failure', () => {
    assert.equal(finishOutcome({ ok: false, error: new Error('no_active_session') }), 'alreadySaved');
  });

  it('every other error is a real failure', () => {
    assert.equal(finishOutcome({ ok: false, error: new Error('sync_queue_not_empty') }), 'failed');
    assert.equal(finishOutcome({ ok: false, error: { code: 'PGRST204', message: 'x' } }), 'failed');
  });
});

describe('afterProgress', () => {
  it('without the template the summary closes, even with accepted steps', () => {
    assert.deepEqual(afterProgress({ templateFound: false, celebration: { levels: 1 } }), { kind: 'dismiss' });
  });

  it('celebrates when steps were written, closes otherwise', () => {
    assert.deepEqual(afterProgress({ templateFound: true, celebration: 'c' }), {
      kind: 'celebrate',
      celebration: 'c',
    });
    assert.deepEqual(afterProgress({ templateFound: true, celebration: null }), { kind: 'dismiss' });
  });
});
