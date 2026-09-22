import * as Sentry from '@sentry/react-native';

import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { refreshMacrosKeepingCalorieGoal } from '@/lib/calorie-goals';
import { supabase } from '@/lib/supabase';
import { resolveTargetWeightUpdateRow } from '@/lib/weight-parse';

export {
  formatWeightDeltaForDisplay,
  formatWeightForDisplay,
  parseWeightInputToKg,
} from '@/lib/weight-parse';

function captureAndThrow(error: unknown): never {
  Sentry.captureException(error);
  throw error;
}

export async function updateTargetWeightKg(params: {
  userId: string;
  targetWeightKg: number;
  /** YYYY-MM-DD, or null to clear. Omit to leave the column unchanged. */
  progressStartDate?: string | null;
}): Promise<number> {
  const payload: {
    target_weight_kg: number;
    progress_start_date?: string | null;
  } = {
    target_weight_kg: params.targetWeightKg,
  };

  if (params.progressStartDate !== undefined) {
    payload.progress_start_date = params.progressStartDate;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', params.userId)
    .select('target_weight_kg')
    .single();

  let savedKg: number;
  try {
    savedKg = resolveTargetWeightUpdateRow({ data, error });
  } catch (resolveError) {
    captureAndThrow(resolveError);
  }

  // Target weight is already persisted. Macro refresh must not turn a successful
  // save into "Speichern fehlgeschlagen" (stale goals-panel cache vs DB).
  try {
    await refreshMacrosKeepingCalorieGoal(params.userId);
  } catch (refreshError) {
    Sentry.captureException(refreshError);
  }

  return savedKg;
}

/** Seeds target weight from the current entry when none exists yet. Never overwrites. */
export async function maybeSeedTargetWeightKg(params: {
  userId: string;
  weightKg: number;
}): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('target_weight_kg')
    .eq('id', params.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.target_weight_kg != null) {
    return;
  }

  await updateTargetWeightKg({
    userId: params.userId,
    targetWeightKg: params.weightKg,
  });
}

function loggedAtForDay(loggedOn: string): string {
  const loggedAt = parseDateOnly(loggedOn);
  // Keep historical measurements in their own local day when sorted by logged_at.
  loggedAt.setHours(12, 0, 0, 0);
  return loggedAt.toISOString();
}

export async function upsertWeightLog(params: {
  userId: string;
  weightKg: number;
  loggedOn: string;
  source?: string;
}) {
  if (!(params.weightKg > 0)) {
    return;
  }

  const loggedOn = params.loggedOn;
  const loggedAt = loggedAtForDay(loggedOn);

  const { data: updatedRows, error: updateError } = await supabase
    .from('weight_logs')
    .update({
      weight_kg: params.weightKg,
      logged_at: loggedAt,
      source: params.source ?? 'manual',
    })
    .eq('user_id', params.userId)
    .eq('logged_on', loggedOn)
    .select('id');

  if (updateError) {
    throw updateError;
  }

  if (updatedRows && updatedRows.length > 0) {
    await maybeSeedTargetWeightKg({ userId: params.userId, weightKg: params.weightKg });
    await refreshMacrosKeepingCalorieGoal(params.userId);
    return;
  }

  const { error: insertError } = await supabase.from('weight_logs').insert({
    user_id: params.userId,
    weight_kg: params.weightKg,
    logged_at: loggedAt,
    logged_on: loggedOn,
    source: params.source ?? 'manual',
  });

  if (insertError) {
    throw insertError;
  }

  await maybeSeedTargetWeightKg({ userId: params.userId, weightKg: params.weightKg });
  await refreshMacrosKeepingCalorieGoal(params.userId);
}

export async function fetchWeightKgForDay(
  userId: string,
  loggedOn: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight_kg')
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data?.weight_kg == null) {
    return null;
  }
  const weightKg = Number(data.weight_kg);
  return Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null;
}

export async function upsertTodayWeightLog(params: {
  userId: string;
  weightKg: number;
  source?: string;
}) {
  return upsertWeightLog({ ...params, loggedOn: localDateKey() });
}

