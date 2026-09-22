import type { UnitSystem } from '@/lib/unit-system';
import { kgToLbs, lbsToKg } from '@/lib/units';

/**
 * Parse a weight field into kg. Imperial input is treated as pounds.
 * Returns null when empty or not a positive number.
 */
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

/**
 * Maps a profiles UPDATE … RETURNING row to the saved kg, or throws
 * `target_weight_update_empty` when PostgREST returned no row.
 */
export function resolveTargetWeightUpdateRow(params: {
  data: { target_weight_kg: number | string | null } | null;
  error: unknown;
}): number {
  if (params.error) {
    throw params.error;
  }

  if (params.data == null || params.data.target_weight_kg == null) {
    throw new Error('target_weight_update_empty');
  }

  const parsed = Number(params.data.target_weight_kg);
  if (!Number.isFinite(parsed) || !(parsed > 0)) {
    throw new Error('target_weight_update_empty');
  }

  return parsed;
}
