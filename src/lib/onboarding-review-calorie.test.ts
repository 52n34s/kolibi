import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CalorieSource,
  calculateDailyCalorieGoalForSource,
  type GoalType,
} from './calorie-goal-math.ts';
import {
  applyOnboardingGoalTypeChange,
  resolveReviewCaloriePrefill,
  shouldRecalculateOnboardingDailyGoal,
  summaryManuallyEditedAfterGoalTypeChange,
} from './onboarding-review-calorie.ts';

const birthDate = new Date('1990-06-15T12:00:00');

function calcFor(goalType: Exclude<GoalType, 'custom'>): number {
  return calculateDailyCalorieGoalForSource({
    biologicalSex: 'female',
    birthDate,
    heightCm: 168,
    weightKg: 70,
    activityLevel: 'lightly_active',
    calorieSource: CalorieSource.ACTIVITY_FACTOR,
    goalType,
  }).effectiveDailyGoal;
}

describe('review calorie prefill and goal-type invalidation', () => {
  it('keeps a custom-sourced 1200 through an untouched review to step 8', () => {
    const prefill = resolveReviewCaloriePrefill({
      calorie_goal_source: 'custom',
      daily_calorie_goal: 1200,
      goal_type: 'lose_weight',
    });

    assert.equal(prefill.summaryManuallyEdited, true);
    assert.equal(prefill.dailyCalorieGoal, '1200');
    assert.equal(
      shouldRecalculateOnboardingDailyGoal({
        summaryManuallyEdited: prefill.summaryManuallyEdited,
        goalType: 'lose_weight',
      }),
      false,
      'custom source must not be overwritten by calculation while untouched',
    );

    // Simulate advancing to step 8 with no goal-type change: field stays 1200.
    assert.equal(prefill.dailyCalorieGoal, '1200');
    assert.notEqual(calcFor('lose_weight'), 1200, 'fixture: calculated goal differs from 1200');
  });

  it('discards a custom-sourced target when the user changes goal type in review', () => {
    // Intentional: changing goal type is a deliberate action that invalidates
    // the previous custom calorie number — recalculate from the new goal type.
    const prefill = resolveReviewCaloriePrefill({
      calorie_goal_source: 'custom',
      daily_calorie_goal: 1200,
      goal_type: 'lose_weight',
    });

    assert.equal(prefill.summaryManuallyEdited, true);
    assert.equal(prefill.dailyCalorieGoal, '1200');

    const after = applyOnboardingGoalTypeChange({
      nextGoalType: 'maintain',
      summaryManuallyEdited: prefill.summaryManuallyEdited,
      currentDailyCalorieGoal: prefill.dailyCalorieGoal!,
      calculate: () => calcFor('maintain'),
    });

    assert.equal(after.summaryManuallyEdited, false);
    assert.equal(after.goalType, 'maintain');
    assert.equal(after.dailyCalorieGoal, String(calcFor('maintain')));
    assert.notEqual(after.dailyCalorieGoal, '1200');
  });

  it('discards a value typed on step 8 when the user later changes goal type on step 6', () => {
    // Prefill as calculated, then user types on summary (step 8).
    const prefill = resolveReviewCaloriePrefill({
      calorie_goal_source: 'calculated',
      daily_calorie_goal: 1800,
      goal_type: 'lose_weight',
    });
    assert.equal(prefill.summaryManuallyEdited, false);
    assert.equal(prefill.dailyCalorieGoal, null, 'calculated goals are not seeded');

    let summaryManuallyEdited = true;
    let dailyCalorieGoal = '1450';
    let goalType: GoalType = 'lose_weight';

    assert.equal(
      shouldRecalculateOnboardingDailyGoal({ summaryManuallyEdited, goalType }),
      false,
    );

    // Back to step 6 — change goal type.
    assert.equal(summaryManuallyEditedAfterGoalTypeChange('gain_weight'), false);

    const after = applyOnboardingGoalTypeChange({
      nextGoalType: 'gain_weight',
      summaryManuallyEdited,
      currentDailyCalorieGoal: dailyCalorieGoal,
      calculate: () => calcFor('gain_weight'),
    });

    summaryManuallyEdited = after.summaryManuallyEdited;
    dailyCalorieGoal = after.dailyCalorieGoal;
    goalType = after.goalType;

    assert.equal(summaryManuallyEdited, false);
    assert.equal(goalType, 'gain_weight');
    assert.equal(dailyCalorieGoal, String(calcFor('gain_weight')));
    assert.notEqual(dailyCalorieGoal, '1450');
  });
});
