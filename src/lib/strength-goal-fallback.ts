import type { GoalType } from '@/lib/calorie-goal-math';
import type { StringKvStorage } from '@/lib/workouts/kv-storage';

/**
 * "Kraft und Skills" is stored as goal_type 'strength' once the migration
 * 20260926183100_add_strength_goal_type ran. Before that the enum rejects the
 * value, so the app writes build_muscle (identical calorie and macro effect)
 * and remembers the choice on the device. The UI then reads build_muscle plus
 * that marker as 'strength'. The next save after the migration writes the
 * real value and drops the marker.
 */

const STRENGTH_CHOICE_KEY_PREFIX = 'goal_choice_strength:';

export function strengthChoiceKey(userId: string): string {
  return `${STRENGTH_CHOICE_KEY_PREFIX}${userId}`;
}

/** goal_type that can be written right now. */
export function resolveGoalTypeForWrite(goalType: GoalType, strengthSupported: boolean): GoalType {
  if (goalType === 'strength' && !strengthSupported) {
    return 'build_muscle';
  }
  return goalType;
}

/** Call after a successful write: keeps the marker only while it is needed. */
export function rememberStrengthChoice(
  storage: StringKvStorage,
  userId: string,
  params: { chosen: GoalType; written: GoalType },
): void {
  if (params.chosen === 'strength' && params.written === 'build_muscle') {
    storage.set(strengthChoiceKey(userId), '1');
    return;
  }
  storage.remove(strengthChoiceKey(userId));
}

export function hasStrengthChoice(storage: StringKvStorage, userId: string): boolean {
  return storage.getString(strengthChoiceKey(userId)) === '1';
}

/** Stored goal_type as the UI should show it. */
export function resolveDisplayedGoalType<T extends string>(
  storedGoalType: T | null | undefined,
  strengthChosenLocally: boolean,
): T | 'strength' | null {
  if (storedGoalType == null) {
    return null;
  }
  if (storedGoalType === 'build_muscle' && strengthChosenLocally) {
    return 'strength';
  }
  return storedGoalType;
}
