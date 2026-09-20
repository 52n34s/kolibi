import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveActiveHistoryArea,
  resolveVisibleHistoryAreas,
  shouldShowHistoryAreaSwitcher,
} from './history-areas.ts';

describe('resolveVisibleHistoryAreas', () => {
  it('keeps nutrition → body → training order and drops empty areas', () => {
    assert.deepEqual(
      resolveVisibleHistoryAreas({ nutrition: true, body: false, training: true }),
      ['nutrition', 'training'],
    );
  });
});

describe('shouldShowHistoryAreaSwitcher', () => {
  it('hides the row when fewer than two areas have content', () => {
    assert.equal(shouldShowHistoryAreaSwitcher([]), false);
    assert.equal(shouldShowHistoryAreaSwitcher(['nutrition']), false);
    assert.equal(shouldShowHistoryAreaSwitcher(['nutrition', 'body']), true);
  });
});

describe('resolveActiveHistoryArea', () => {
  it('falls back to the first visible area when the selection is gone', () => {
    assert.equal(
      resolveActiveHistoryArea({
        selected: 'training',
        visible: ['nutrition', 'body'],
      }),
      'nutrition',
    );
  });

  it('keeps the selection when that area is still visible', () => {
    assert.equal(
      resolveActiveHistoryArea({
        selected: 'body',
        visible: ['nutrition', 'body'],
      }),
      'body',
    );
  });
});
