import type { GoalType } from '@/lib/calorie-goal-math';

/**
 * Cleaned goal choice shown in the onboarding and the goals area.
 * Each category maps to one profiles.goal_type for new users; older goal
 * types (gain_weight, faster_weight_loss, custom) stay stored as they are
 * and only show up under the category they belong to.
 */
export type GoalCategory = 'lose' | 'muscle' | 'strength' | 'maintain' | 'endurance' | 'custom';

/** Order in the onboarding. `custom` is only listed for users who already have it. */
export const GOAL_CATEGORY_ORDER = [
  'lose',
  'muscle',
  'strength',
  'maintain',
  'endurance',
] as const satisfies readonly GoalCategory[];

/** goal_type a new choice writes. `strength` needs the enum migration (see strength-goal-fallback). */
export const DEFAULT_GOAL_TYPE_BY_CATEGORY = {
  lose: 'lose_weight',
  muscle: 'build_muscle',
  strength: 'strength',
  maintain: 'maintain',
  endurance: 'endurance',
  custom: 'custom',
} as const satisfies Record<GoalCategory, GoalType>;

/**
 * Stored goal_type → category. Legacy values keep their own effect and are
 * shown under the closest category: gain_weight → muscle,
 * faster_weight_loss → lose, custom → custom. The dead enum labels
 * lose / faster_loss read as lose.
 */
export function goalCategoryForGoalType(goalType: string | null | undefined): GoalCategory | null {
  switch (goalType) {
    case 'lose_weight':
    case 'faster_weight_loss':
    case 'lose':
    case 'faster_loss':
      return 'lose';
    case 'build_muscle':
    case 'gain_weight':
      return 'muscle';
    case 'strength':
      return 'strength';
    case 'maintain':
      return 'maintain';
    case 'endurance':
      return 'endurance';
    case 'custom':
      return 'custom';
    default:
      return null;
  }
}

/**
 * goal_type for a picked category. When the user's current goal already
 * belongs to that category it is kept, so picking "Muskelaufbau" leaves an
 * existing gain_weight (with its surplus) untouched.
 */
export function goalTypeForCategory(
  category: GoalCategory,
  currentGoalType?: string | null,
): GoalType {
  if (
    currentGoalType != null &&
    currentGoalType !== 'lose' &&
    currentGoalType !== 'faster_loss' &&
    goalCategoryForGoalType(currentGoalType) === category
  ) {
    return currentGoalType as GoalType;
  }
  return DEFAULT_GOAL_TYPE_BY_CATEGORY[category];
}

/** Stored goal types that are no longer offered but keep their effect. */
export type LegacyGoalType = 'gain_weight' | 'faster_weight_loss' | 'custom';

export function isLegacyGoalType(goalType: string | null | undefined): goalType is LegacyGoalType {
  return goalType === 'gain_weight' || goalType === 'faster_weight_loss' || goalType === 'custom';
}

/** Categories to list. "Eigenes Ziel" only appears for users who already have it. */
export function visibleGoalCategories(currentGoalType: string | null | undefined): GoalCategory[] {
  const categories: GoalCategory[] = [...GOAL_CATEGORY_ORDER];
  if (currentGoalType === 'custom') {
    categories.push('custom');
  }
  return categories;
}
