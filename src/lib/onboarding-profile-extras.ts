import type { GoalType } from '@/lib/calorie-goal-math';
import { createSchemaProbe, isUnknownEnumValueError } from '@/lib/db-schema-errors';
import {
  getLocalUsagePurpose,
  hasLocalStrengthChoice,
  rememberLocalStrengthChoice,
  setLocalUsagePurpose,
} from '@/lib/onboarding-local-state';
import { resolveDisplayedGoalType, resolveGoalTypeForWrite } from '@/lib/strength-goal-fallback';
import { supabase } from '@/lib/supabase';
import { parseUsagePurpose, type UsagePurpose } from '@/lib/usage-purpose';

/**
 * Profile values from block 3.1 whose migrations may not have run yet.
 * Each is probed once per app run; without the migration the value lives on
 * the device and the feature keeps working.
 */

/** profiles.usage_purpose (20260926183200_profiles_usage_purpose). */
const hasUsagePurposeColumn = createSchemaProbe(() =>
  supabase.from('profiles').select('usage_purpose').limit(0),
);

/** goal_type 'strength' (20260926183100_add_strength_goal_type). Unknown label → 22P02. */
const hasStrengthGoalType = createSchemaProbe(
  () => supabase.from('profiles').select('id').eq('goal_type', 'strength').limit(0),
  isUnknownEnumValueError,
);

/** goal_type to send for the picked one ('strength' → build_muscle before the migration). */
export async function resolveWritableGoalType(goalType: GoalType): Promise<GoalType> {
  if (goalType !== 'strength') {
    return goalType;
  }
  let supported = false;
  try {
    supported = await hasStrengthGoalType();
  } catch {
    supported = false;
  }
  return resolveGoalTypeForWrite(goalType, supported);
}

/** Call after the goal was saved. */
export function recordWrittenGoalType(
  userId: string,
  params: { chosen: GoalType; written: GoalType },
): void {
  rememberLocalStrengthChoice(userId, params);
}

/** Stored goal_type as the UI shows it (build_muscle + local marker → strength). */
export function displayedGoalType(
  userId: string | null | undefined,
  storedGoalType: GoalType | null | undefined,
): GoalType | null {
  return resolveDisplayedGoalType(
    storedGoalType,
    userId != null && hasLocalStrengthChoice(userId),
  );
}

/** Keeps the answer on the device and writes the column when it exists. */
export async function saveUsagePurpose(userId: string, purpose: UsagePurpose): Promise<void> {
  setLocalUsagePurpose(userId, purpose);
  try {
    if (!(await hasUsagePurposeColumn())) {
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ usage_purpose: purpose })
      .eq('id', userId);
    if (error) {
      console.warn('[Onboarding] usage_purpose save failed:', error.message);
    }
  } catch (error) {
    console.warn('[Onboarding] usage_purpose save failed:', error);
  }
}

/** Profile value when the column exists, else the device copy. */
export async function fetchUsagePurpose(userId: string): Promise<UsagePurpose | null> {
  const local = getLocalUsagePurpose(userId);
  try {
    if (!(await hasUsagePurposeColumn())) {
      return local;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('usage_purpose')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      return local;
    }
    return parseUsagePurpose((data as { usage_purpose?: unknown } | null)?.usage_purpose) ?? local;
  } catch {
    return local;
  }
}
