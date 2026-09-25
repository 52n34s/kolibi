import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_GOAL_TYPE_BY_CATEGORY,
  GOAL_CATEGORY_ORDER,
  goalCategoryForGoalType,
  goalTypeForCategory,
  isLegacyGoalType,
  visibleGoalCategories,
} from './goal-category.ts';

describe('goalCategoryForGoalType', () => {
  it('maps the offered goal types to their category', () => {
    assert.equal(goalCategoryForGoalType('lose_weight'), 'lose');
    assert.equal(goalCategoryForGoalType('build_muscle'), 'muscle');
    assert.equal(goalCategoryForGoalType('strength'), 'strength');
    assert.equal(goalCategoryForGoalType('maintain'), 'maintain');
    assert.equal(goalCategoryForGoalType('endurance'), 'endurance');
  });

  it('shows legacy goal types under the closest category', () => {
    assert.equal(goalCategoryForGoalType('gain_weight'), 'muscle');
    assert.equal(goalCategoryForGoalType('faster_weight_loss'), 'lose');
    assert.equal(goalCategoryForGoalType('custom'), 'custom');
    assert.equal(goalCategoryForGoalType('lose'), 'lose');
    assert.equal(goalCategoryForGoalType('faster_loss'), 'lose');
  });

  it('unknown or empty → null', () => {
    assert.equal(goalCategoryForGoalType(null), null);
    assert.equal(goalCategoryForGoalType(undefined), null);
    assert.equal(goalCategoryForGoalType('MUSKELAUFBAU'), null);
  });
});

describe('goalTypeForCategory', () => {
  it('new users get the default goal type per category', () => {
    assert.equal(goalTypeForCategory('lose'), 'lose_weight');
    assert.equal(goalTypeForCategory('muscle'), 'build_muscle');
    assert.equal(goalTypeForCategory('strength'), 'strength');
    assert.equal(goalTypeForCategory('maintain'), 'maintain');
    assert.equal(goalTypeForCategory('endurance'), 'endurance');
  });

  it('keeps a legacy goal when its own category is picked again', () => {
    assert.equal(goalTypeForCategory('muscle', 'gain_weight'), 'gain_weight');
    assert.equal(goalTypeForCategory('lose', 'faster_weight_loss'), 'faster_weight_loss');
    assert.equal(goalTypeForCategory('custom', 'custom'), 'custom');
  });

  it('switching category replaces the legacy goal', () => {
    assert.equal(goalTypeForCategory('lose', 'gain_weight'), 'lose_weight');
    assert.equal(goalTypeForCategory('maintain', 'faster_weight_loss'), 'maintain');
    assert.equal(goalTypeForCategory('strength', 'build_muscle'), 'strength');
  });

  it('dead enum labels are never written back', () => {
    assert.equal(goalTypeForCategory('lose', 'lose'), 'lose_weight');
    assert.equal(goalTypeForCategory('lose', 'faster_loss'), 'lose_weight');
  });

  it('round-trips every category', () => {
    for (const category of [...GOAL_CATEGORY_ORDER, 'custom' as const]) {
      assert.equal(goalCategoryForGoalType(DEFAULT_GOAL_TYPE_BY_CATEGORY[category]), category);
    }
  });
});

describe('visibleGoalCategories', () => {
  it('lists the five cleaned goals in order', () => {
    assert.deepEqual(visibleGoalCategories(null), [
      'lose',
      'muscle',
      'strength',
      'maintain',
      'endurance',
    ]);
    assert.deepEqual(visibleGoalCategories('gain_weight'), visibleGoalCategories(null));
  });

  it('adds "Eigenes Ziel" only for users who have it', () => {
    assert.deepEqual(visibleGoalCategories('custom').at(-1), 'custom');
    assert.equal(visibleGoalCategories('maintain').includes('custom'), false);
  });
});

describe('isLegacyGoalType', () => {
  it('flags the goal types that are no longer offered', () => {
    assert.equal(isLegacyGoalType('gain_weight'), true);
    assert.equal(isLegacyGoalType('faster_weight_loss'), true);
    assert.equal(isLegacyGoalType('custom'), true);
    assert.equal(isLegacyGoalType('build_muscle'), false);
    assert.equal(isLegacyGoalType('strength'), false);
    assert.equal(isLegacyGoalType(null), false);
  });
});
