import { localDateKey } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';
import type { UnitSystem } from '@/lib/unit-system';
import { kgToLbs, lbsToKg } from '@/lib/units';

export async function updateTargetWeightKg(params: {
  userId: string;
  targetWeightKg: number;
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ target_weight_kg: params.targetWeightKg })
    .eq('id', params.userId);

  if (error) {
    throw error;
  }
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

export async function upsertTodayWeightLog(params: {
  userId: string;
  weightKg: number;
  source?: string;
}) {
  const now = new Date().toISOString();
  const loggedOn = localDateKey();

  const { data: updatedRows, error: updateError } = await supabase
    .from('weight_logs')
    .update({
      weight_kg: params.weightKg,
      logged_at: now,
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
    return;
  }

  const { error: insertError } = await supabase.from('weight_logs').insert({
    user_id: params.userId,
    weight_kg: params.weightKg,
    logged_at: now,
    logged_on: loggedOn,
    source: params.source ?? 'manual',
  });

  if (insertError) {
    throw insertError;
  }

  await maybeSeedTargetWeightKg({ userId: params.userId, weightKg: params.weightKg });
}

export function formatWeightForDisplay(params: {
  weightKg: number;
  unitSystem: UnitSystem;
  kgLabel: string;
  lbsLabel: string;
}): string {
  if (params.unitSystem === 'imperial') {
    return `${kgToLbs(params.weightKg)} ${params.lbsLabel}`;
  }

  const kg = Math.round(params.weightKg * 10) / 10;
  return `${kg} ${params.kgLabel}`;
}

export function formatWeightDeltaForDisplay(params: {
  deltaKg: number;
  unitSystem: UnitSystem;
  kgLabel: string;
  lbsLabel: string;
}): string | null {
  if (Math.abs(params.deltaKg) < 0.05) {
    return null;
  }

  const sign = params.deltaKg > 0 ? '+' : '-';
  const absKg = Math.abs(params.deltaKg);

  if (params.unitSystem === 'imperial') {
    return `${sign}${kgToLbs(absKg)} ${params.lbsLabel}`;
  }

  const kg = Math.round(absKg * 10) / 10;
  return `${sign}${kg} ${params.kgLabel}`;
}

export function parseWeightInputToKg(params: {
  value: string;
  unitSystem: UnitSystem;
}): number | null {
  const parsed = Number(params.value.replace(',', '.'));
  if (!parsed || parsed <= 0) {
    return null;
  }

  if (params.unitSystem === 'imperial') {
    return lbsToKg(parsed);
  }

  return parsed;
}
