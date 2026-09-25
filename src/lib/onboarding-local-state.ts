import { createMMKV } from 'react-native-mmkv';

import {
  hasStrengthChoice,
  rememberStrengthChoice,
} from '@/lib/strength-goal-fallback';
import type { GoalType } from '@/lib/calorie-goal-math';
import { parseUsagePurpose, type UsagePurpose } from '@/lib/usage-purpose';
import type { StringKvStorage } from '@/lib/workouts/kv-storage';

/**
 * Device-local onboarding state, per user. Used for values whose column or
 * enum value may not exist yet, and for one-time first-use markers.
 */

const mmkv = createMMKV({ id: 'app-settings' });

export const onboardingLocalStorage: StringKvStorage = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => {
    mmkv.remove(key);
  },
};

const USAGE_PURPOSE_KEY = 'usage_purpose:';
const PLAN_WIZARD_PENDING_KEY = 'plan_wizard_pending:';
const DIET_CARD_DONE_KEY = 'diet_card_done:';

export function getLocalUsagePurpose(userId: string): UsagePurpose | null {
  return parseUsagePurpose(onboardingLocalStorage.getString(`${USAGE_PURPOSE_KEY}${userId}`));
}

export function setLocalUsagePurpose(userId: string, purpose: UsagePurpose): void {
  onboardingLocalStorage.set(`${USAGE_PURPOSE_KEY}${userId}`, purpose);
}

export function isPlanWizardPending(userId: string): boolean {
  return onboardingLocalStorage.getString(`${PLAN_WIZARD_PENDING_KEY}${userId}`) === '1';
}

export function setPlanWizardPending(userId: string, pending: boolean): void {
  if (pending) {
    onboardingLocalStorage.set(`${PLAN_WIZARD_PENDING_KEY}${userId}`, '1');
    return;
  }
  onboardingLocalStorage.remove(`${PLAN_WIZARD_PENDING_KEY}${userId}`);
}

export function isDietCardDone(userId: string): boolean {
  return onboardingLocalStorage.getString(`${DIET_CARD_DONE_KEY}${userId}`) === '1';
}

export function markDietCardDone(userId: string): void {
  onboardingLocalStorage.set(`${DIET_CARD_DONE_KEY}${userId}`, '1');
}

export function hasLocalStrengthChoice(userId: string): boolean {
  return hasStrengthChoice(onboardingLocalStorage, userId);
}

export function rememberLocalStrengthChoice(
  userId: string,
  params: { chosen: GoalType; written: GoalType },
): void {
  rememberStrengthChoice(onboardingLocalStorage, userId, params);
}
