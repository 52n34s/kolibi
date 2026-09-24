import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldSeedWeeklyGoal } from './should-seed-weekly-goal.ts';

describe('shouldSeedWeeklyGoal', () => {
  it('seeds when the goal is missing or zero', () => {
    assert.equal(shouldSeedWeeklyGoal(null), true);
    assert.equal(shouldSeedWeeklyGoal(undefined), true);
    assert.equal(shouldSeedWeeklyGoal(0), true);
  });

  it('does not seed when a real weekly goal is set', () => {
    assert.equal(shouldSeedWeeklyGoal(1), false);
    assert.equal(shouldSeedWeeklyGoal(3), false);
  });
});
