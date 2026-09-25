import * as Sentry from '@sentry/react-native';
import { createMMKV } from 'react-native-mmkv';

import { isMissingSchemaError } from '@/lib/missing-schema';
import { supabase } from '@/lib/supabase';
import type { PlanWizardAnswers } from '@/lib/workouts/plan-builder';
import type { PlanEquipment } from '@/lib/workouts/plan-catalog';
import {
  initialPlanWizardAnswers,
  parseStoredPlanWizardAnswers,
  toStoredPlanWizardAnswers,
} from '@/lib/workouts/plan-wizard-answers';

const LOCAL_KEY_PREFIX = 'plan_wizard_answers:';
const storage = createMMKV({ id: 'app-settings' });

function readLocal(userId: string): unknown {
  try {
    const raw = storage.getString(`${LOCAL_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Gear from the last wizard run on this device, or null when it never ran here. */
export function readStoredPlanEquipment(userId: string | null | undefined): PlanEquipment[] | null {
  if (!userId) {
    return null;
  }
  const parsed = parseStoredPlanWizardAnswers(readLocal(userId));
  return parsed?.equipment ? [...parsed.equipment] : null;
}

/**
 * Wizard start values: profiles.plan_wizard_answers, else the device copy,
 * else defaults. Never throws — a missing column (migration not run) or a
 * network error only means the wizard starts from the device or defaults.
 */
export async function loadPlanWizardAnswers(userId: string | null | undefined): Promise<PlanWizardAnswers> {
  if (!userId) {
    return initialPlanWizardAnswers(null);
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan_wizard_answers')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    const remote = (data as { plan_wizard_answers?: unknown } | null)?.plan_wizard_answers;
    if (parseStoredPlanWizardAnswers(remote)) {
      return initialPlanWizardAnswers(remote);
    }
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      Sentry.captureException(error);
    }
  }
  return initialPlanWizardAnswers(readLocal(userId));
}

/** Device copy first, then the profile. Never throws. */
export async function savePlanWizardAnswers(
  userId: string | null | undefined,
  answers: PlanWizardAnswers,
): Promise<void> {
  if (!userId) {
    return;
  }
  const stored = toStoredPlanWizardAnswers(answers);
  try {
    storage.set(`${LOCAL_KEY_PREFIX}${userId}`, JSON.stringify(stored));
  } catch (error) {
    Sentry.captureException(error);
  }
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ plan_wizard_answers: stored })
      .eq('id', userId);
    if (error) {
      throw error;
    }
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      Sentry.captureException(error);
    }
  }
}
