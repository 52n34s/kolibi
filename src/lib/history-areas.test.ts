import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  historyTrainingHasOwnContent,
  resolveActiveHistoryArea,
  resolveHistoryTrainingVisible,
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

describe('resolveHistoryTrainingVisible', () => {
  it('shows training when a session, goal, or Health connection exists', () => {
    assert.equal(
      historyTrainingHasOwnContent({
        hasSessionInRange: true,
        hasMovementGoal: false,
        healthConnected: false,
      }),
      true,
    );
    assert.equal(
      resolveHistoryTrainingVisible({
        nutrition: false,
        body: false,
        hasSessionInRange: false,
        hasMovementGoal: false,
        healthConnected: true,
      }),
      true,
    );
  });

  it('hitchhikes empty training only when nutrition and body already fill the pill row', () => {
    assert.equal(
      resolveHistoryTrainingVisible({
        nutrition: true,
        body: true,
        hasSessionInRange: false,
        hasMovementGoal: false,
        healthConnected: false,
      }),
      true,
    );
    assert.equal(
      resolveHistoryTrainingVisible({
        nutrition: true,
        body: false,
        hasSessionInRange: false,
        hasMovementGoal: false,
        healthConnected: false,
      }),
      false,
    );
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
