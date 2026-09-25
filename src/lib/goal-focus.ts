import type { GoalCategory } from '@/lib/goal-category';

/**
 * Ziel → Schwerpunkte der Empfehlungen. Fixed table a recommendation engine
 * can read: which topics to lead with per goal, most important first, each
 * with a goal-specific reason. Protein is part of every goal.
 */

export type RecommendationFocus =
  | 'protein'
  | 'fiber'
  | 'strength_training'
  | 'carbs_around_training'
  | 'sets_per_muscle'
  | 'carbs_before_training'
  | 'recovery'
  | 'daily_readiness'
  | 'consistency'
  | 'carbs_on_run_days';

export type GoalFocusEntry = {
  focus: RecommendationFocus;
  /** i18n key: short label of the topic. */
  labelKey: `onboarding2.focus.label.${RecommendationFocus}`;
  /** i18n key: why this topic matters for this goal. */
  reasonKey: `onboarding2.focus.reason.${GoalCategory}.${RecommendationFocus}`;
};

function entry<C extends GoalCategory, F extends RecommendationFocus>(
  category: C,
  focus: F,
): GoalFocusEntry {
  return {
    focus,
    labelKey: `onboarding2.focus.label.${focus}`,
    reasonKey: `onboarding2.focus.reason.${category}.${focus}`,
  };
}

export const GOAL_FOCUS: Record<GoalCategory, readonly GoalFocusEntry[]> = {
  lose: [entry('lose', 'protein'), entry('lose', 'fiber'), entry('lose', 'strength_training')],
  muscle: [
    entry('muscle', 'protein'),
    entry('muscle', 'carbs_around_training'),
    entry('muscle', 'sets_per_muscle'),
  ],
  strength: [
    entry('strength', 'carbs_before_training'),
    entry('strength', 'recovery'),
    entry('strength', 'daily_readiness'),
    entry('strength', 'protein'),
  ],
  maintain: [
    entry('maintain', 'fiber'),
    entry('maintain', 'protein'),
    entry('maintain', 'consistency'),
  ],
  endurance: [entry('endurance', 'carbs_on_run_days'), entry('endurance', 'protein')],
  custom: [entry('custom', 'protein'), entry('custom', 'consistency')],
};

export function goalFocusFor(category: GoalCategory | null | undefined): readonly GoalFocusEntry[] {
  return category ? GOAL_FOCUS[category] : [];
}
