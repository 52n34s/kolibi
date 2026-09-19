import type { GoalType } from '@/lib/calorie-goal-math';

export type CalorieGoalSource = 'calculated' | 'custom';

/** Profile slice that seeds the review calorie field. */
export type ReviewCalorieProfileSeed = {
  calorie_goal_source: CalorieGoalSource | string | null;
  daily_calorie_goal: number | null;
  goal_type: GoalType | null;
};

export type ReviewCaloriePrefill = {
  /** Protects a custom/typed target until the user changes goal type. */
  summaryManuallyEdited: boolean;
  /** null = leave empty for the recalculation path. */
  dailyCalorieGoal: string | null;
  customCalorieGoal: string | null;
};

/**
 * Review prefill for the summary calorie field.
 * Only a custom-sourced target is seeded; calculated goals must be derived so a
 * late profile fetch cannot stomp a goal-type change the user already made.
 */
export function resolveReviewCaloriePrefill(
  profile: ReviewCalorieProfileSeed,
): ReviewCaloriePrefill {
  if (profile.calorie_goal_source === 'custom') {
    const calories =
      profile.daily_calorie_goal != null ? String(profile.daily_calorie_goal) : null;
    return {
      summaryManuallyEdited: true,
      dailyCalorieGoal: calories,
      customCalorieGoal:
        profile.goal_type === 'custom' && calories != null ? calories : null,
    };
  }

  if (profile.goal_type === 'custom' && profile.daily_calorie_goal != null) {
    const calories = String(profile.daily_calorie_goal);
    return {
      summaryManuallyEdited: false,
      dailyCalorieGoal: calories,
      customCalorieGoal: calories,
    };
  }

  return {
    summaryManuallyEdited: false,
    dailyCalorieGoal: null,
    customCalorieGoal: null,
  };
}

/** True when the summary field should be overwritten by calculateDailyCalorieGoal. */
export function shouldRecalculateOnboardingDailyGoal(params: {
  summaryManuallyEdited: boolean;
  goalType: GoalType | null;
}): boolean {
  if (params.summaryManuallyEdited) {
    return false;
  }
  if (params.goalType == null || params.goalType === 'custom') {
    return false;
  }
  return true;
}

/**
 * Goal-type tap on step 6. Choosing a structured goal clears the manual flag —
 * a goal-type change invalidates a previously typed or custom-sourced target.
 * Choosing `custom` leaves the flag alone (the custom field owns the number).
 * Returns null for the flag when it should stay unchanged.
 */
export function summaryManuallyEditedAfterGoalTypeChange(
  nextGoalType: GoalType,
): boolean | null {
  if (nextGoalType === 'custom') {
    return null;
  }
  return false;
}

/** Apply a goal-type change and optionally refresh the summary calories. */
export function applyOnboardingGoalTypeChange(params: {
  nextGoalType: GoalType;
  summaryManuallyEdited: boolean;
  currentDailyCalorieGoal: string;
  calculate: (() => number) | null;
}): {
  goalType: GoalType;
  summaryManuallyEdited: boolean;
  dailyCalorieGoal: string;
} {
  const flag = summaryManuallyEditedAfterGoalTypeChange(params.nextGoalType);
  const summaryManuallyEdited =
    flag === null ? params.summaryManuallyEdited : flag;

  let dailyCalorieGoal = params.currentDailyCalorieGoal;
  if (
    shouldRecalculateOnboardingDailyGoal({
      summaryManuallyEdited,
      goalType: params.nextGoalType,
    }) &&
    params.calculate != null
  ) {
    dailyCalorieGoal = String(params.calculate());
  }

  return {
    goalType: params.nextGoalType,
    summaryManuallyEdited,
    dailyCalorieGoal,
  };
}
