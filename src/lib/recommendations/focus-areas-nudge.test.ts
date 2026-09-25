import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryKvStorage } from '../workouts/kv-storage.ts';
import {
  focusAreasNudgeKey,
  readFocusAreasNudgeDismissed,
  shouldShowFocusAreasNudge,
  writeFocusAreasNudgeDismissed,
} from './focus-areas-nudge.ts';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 3600_000).toISOString();

function params(overrides: Partial<Parameters<typeof shouldShowFocusAreasNudge>[0]> = {}) {
  return {
    accountCreatedAt: daysAgo(10),
    focusAreas: null,
    dismissed: false,
    nowMs: NOW,
    ...overrides,
  };
}

describe('shouldShowFocusAreasNudge', () => {
  it('after a week without chosen topics', () => {
    assert.equal(shouldShowFocusAreasNudge(params()), true);
    assert.equal(shouldShowFocusAreasNudge(params({ accountCreatedAt: daysAgo(7) })), true);
  });

  it('not in the first week', () => {
    assert.equal(shouldShowFocusAreasNudge(params({ accountCreatedAt: daysAgo(6) })), false);
  });

  it('not once something is chosen, and not after a dismissal', () => {
    assert.equal(shouldShowFocusAreasNudge(params({ focusAreas: ['more_fiber'] })), false);
    assert.equal(shouldShowFocusAreasNudge(params({ dismissed: true })), false);
  });

  it('an empty list still counts as nothing chosen', () => {
    assert.equal(shouldShowFocusAreasNudge(params({ focusAreas: [] })), true);
  });

  it('unknown account age stays quiet', () => {
    assert.equal(shouldShowFocusAreasNudge(params({ accountCreatedAt: null })), false);
    assert.equal(shouldShowFocusAreasNudge(params({ accountCreatedAt: 'nope' })), false);
  });
});

describe('focus area nudge dismissal', () => {
  it('writes and reads per user', () => {
    const storage = createMemoryKvStorage();
    assert.equal(readFocusAreasNudgeDismissed(storage, 'u1'), false);
    writeFocusAreasNudgeDismissed(storage, 'u1', new Date(NOW));
    assert.equal(readFocusAreasNudgeDismissed(storage, 'u1'), true);
    assert.equal(readFocusAreasNudgeDismissed(storage, 'u2'), false);
    assert.equal(storage.getString(focusAreasNudgeKey('u1')), new Date(NOW).toISOString());
  });
});
