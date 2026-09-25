import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { revealScrollOffset } from './reveal-scroll.ts';

describe('revealScrollOffset', () => {
  // Content 900 = button bottom at 790 + padding 24 + bar 86; viewport 700.
  const base = { contentHeight: 900, viewportHeight: 700, overlayHeight: 86, paddingBelowTarget: 110 };

  it('scrolls the button above the bar when the bar covers it', () => {
    assert.equal(revealScrollOffset({ ...base, scrollY: 0 }), 790 + 8 - (700 - 86));
  });

  it('does nothing when the button is already clear of the bar', () => {
    assert.equal(revealScrollOffset({ ...base, scrollY: 200 }), null);
  });

  it('small screens: never past the end of the content', () => {
    const small = { ...base, viewportHeight: 300 };
    const offset = revealScrollOffset({ ...small, scrollY: 0 })!;
    assert.ok(offset <= 900 - 300);
  });

  it('without a bar only the viewport edge counts', () => {
    assert.equal(
      revealScrollOffset({ contentHeight: 600, viewportHeight: 700, overlayHeight: 0, paddingBelowTarget: 24, scrollY: 0 }),
      null,
    );
  });
});
