import { getTodayEffectiveFrom } from '@/lib/calorie-goals';
import { supabase } from '@/lib/supabase';
import type { UnitSystem } from '@/lib/unit-system';
import { kgToLbs, lbsToKg } from '@/lib/units';

export async function upsertTodayWeightLog(params: {
  userId: string;
  weightKg: number;
  source?: string;
}) {
  const now = new Date().toISOString();
  const loggedOn = getTodayEffectiveFrom();

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
    return;
  }

  const { error: insertError } = await supabase.from('weight_logs').insert({
    user_id: params.userId,
    weight_kg: params.weightKg,
    logged_at: now,
    source: params.source ?? 'manual',
  });

  if (insertError) {
    throw insertError;
  }
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
