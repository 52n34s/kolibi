import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';
import type { UnitSystem } from '@/lib/unit-system';
import { cmToInches, inchesToCm } from '@/lib/units';

export const MIN_WAIST_CM = 30;
export const MAX_WAIST_CM = 250;

function isWaistCmInRange(waistCm: number): boolean {
  return Number.isFinite(waistCm) && waistCm > MIN_WAIST_CM && waistCm < MAX_WAIST_CM;
}

/** Parse a waist field; convert imperial inches → cm. Always stores metric. */
export function parseWaistInputToCm(params: {
  value: string;
  unitSystem: UnitSystem;
}): number | null {
  const parsed = Number(params.value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const waistCm =
    params.unitSystem === 'imperial' ? inchesToCm(parsed) : Math.round(parsed * 10) / 10;
  if (!isWaistCmInRange(waistCm)) {
    return null;
  }

  return waistCm;
}

function loggedAtForDay(loggedOn: string): string {
  const loggedAt = parseDateOnly(loggedOn);
  loggedAt.setHours(12, 0, 0, 0);
  return loggedAt.toISOString();
}

export async function upsertWaistLog(params: {
  userId: string;
  waistCm: number;
  loggedOn: string;
}): Promise<void> {
  if (!(params.waistCm > 0)) {
    return;
  }

  const loggedOn = params.loggedOn;
  const payload = {
    waist_cm: params.waistCm,
    logged_at: loggedAtForDay(loggedOn),
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('waist_logs')
    .update(payload)
    .eq('user_id', params.userId)
    .eq('logged_on', loggedOn)
    .select('id');

  if (updateError) {
    throw updateError;
  }

  if (updatedRows?.length) {
    return;
  }

  const { error: insertError } = await supabase.from('waist_logs').insert({
    user_id: params.userId,
    ...payload,
    logged_on: loggedOn,
  });

  if (insertError) {
    throw insertError;
  }
}

export async function upsertTodayWaistLog(params: {
  userId: string;
  waistCm: number;
}): Promise<void> {
  return upsertWaistLog({ ...params, loggedOn: localDateKey() });
}

export async function fetchWaistCmForDay(
  userId: string,
  loggedOn: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('waist_logs')
    .select('waist_cm')
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data?.waist_cm == null) {
    return null;
  }
  const waistCm = Number(data.waist_cm);
  return Number.isFinite(waistCm) && waistCm > 0 ? waistCm : null;
}

/** Clears one day, e.g. when the measurements sheet empties the waist field. */
export async function deleteWaistLogForDay(userId: string, loggedOn: string): Promise<void> {
  const { error } = await supabase
    .from('waist_logs')
    .delete()
    .eq('user_id', userId)
    .eq('logged_on', loggedOn);
  if (error) {
    throw error;
  }
}

export function formatWaistForDisplay(params: {
  waistCm: number;
  unitSystem: UnitSystem;
  locale: string;
  cmLabel: string;
  inLabel: string;
}): string {
  if (params.unitSystem === 'imperial') {
    return `${cmToInches(params.waistCm).toLocaleString(params.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} ${params.inLabel}`;
  }

  return `${params.waistCm.toLocaleString(params.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} ${params.cmLabel}`;
}

export function formatWaistDeltaForDisplay(params: {
  deltaCm: number;
  unitSystem: UnitSystem;
  locale: string;
  cmLabel: string;
  inLabel: string;
}): string | null {
  if (Math.abs(params.deltaCm) < 0.05) {
    return null;
  }

  const sign = params.deltaCm > 0 ? '+' : '−';
  return `${sign}${formatWaistForDisplay({
    waistCm: Math.abs(params.deltaCm),
    unitSystem: params.unitSystem,
    locale: params.locale,
    cmLabel: params.cmLabel,
    inLabel: params.inLabel,
  })}`;
}
