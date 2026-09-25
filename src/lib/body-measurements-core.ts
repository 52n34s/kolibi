import type { UnitSystem } from '@/lib/unit-system';
import { cmToInches, inchesToCm } from '@/lib/units';

/**
 * Body circumferences. The waist is stored in waist_logs (and mirrored to
 * Apple Health); chest, arm, hip and thigh live in body_measurements.
 */
export type MeasurementField = 'chest' | 'arm' | 'waist' | 'hip' | 'thigh';

/** Sheet order: the three core fields first, hip and thigh after them. */
export const MEASUREMENT_FIELDS: readonly MeasurementField[] = [
  'chest',
  'arm',
  'waist',
  'hip',
  'thigh',
];

/** Exclusive cm bounds per field; the same bounds as the table checks. */
export const MEASUREMENT_RANGE_CM: Readonly<Record<MeasurementField, { min: number; max: number }>> = {
  chest: { min: 40, max: 250 },
  arm: { min: 10, max: 100 },
  waist: { min: 30, max: 250 },
  hip: { min: 40, max: 250 },
  thigh: { min: 20, max: 150 },
};

export type BodyMeasurementValues = {
  chest_cm: number | null;
  arm_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
};

export type BodyMeasurementRow = BodyMeasurementValues & {
  measured_on: string;
};

export type MeasurementParseResult = { ok: true; cm: number | null } | { ok: false };

/**
 * Parses one optional field. Empty → `{ ok: true, cm: null }`. Imperial input
 * is inches; the result is always cm with one decimal.
 */
export function parseMeasurementInputToCm(params: {
  field: MeasurementField;
  value: string;
  unitSystem: UnitSystem;
}): MeasurementParseResult {
  const trimmed = params.value.trim();
  if (trimmed.length === 0) {
    return { ok: true, cm: null };
  }
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false };
  }
  const cm = params.unitSystem === 'imperial' ? inchesToCm(parsed) : Math.round(parsed * 10) / 10;
  const range = MEASUREMENT_RANGE_CM[params.field];
  if (!(cm > range.min && cm < range.max)) {
    return { ok: false };
  }
  return { ok: true, cm };
}

/** Prefill text for a stored cm value (inches with one decimal for imperial). */
export function measurementCmToDraft(cm: number | null, unitSystem: UnitSystem): string {
  if (cm == null || !Number.isFinite(cm) || cm <= 0) {
    return '';
  }
  return unitSystem === 'imperial' ? String(cmToInches(cm)) : String(Math.round(cm * 10) / 10);
}

function hasAnyValue(row: BodyMeasurementValues): boolean {
  return (
    row.chest_cm != null || row.arm_cm != null || row.hip_cm != null || row.thigh_cm != null
  );
}

/**
 * True once the user has saved at least one body measurement (chest, arm, hip
 * or thigh). The waist alone does not count: it is also entered in the weight
 * sheet by people who never open the measurements sheet.
 */
export function usesMeasurements(rows: readonly BodyMeasurementValues[]): boolean {
  return rows.some(hasAnyValue);
}

function dayNumber(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    return null;
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/**
 * Whole calendar days from the latest measurement day to `todayKey` (0 = measured
 * today). Future days are ignored. Null when there is no measurement.
 * Callers pass the days of body_measurements rows, optionally with waist days.
 */
export function daysSinceLastMeasurement(params: {
  measuredOn: readonly string[];
  todayKey: string;
}): number | null {
  const today = dayNumber(params.todayKey);
  if (today == null) {
    return null;
  }
  let latest: number | null = null;
  for (const key of params.measuredOn) {
    const day = dayNumber(key);
    if (day == null || day > today) {
      continue;
    }
    if (latest == null || day > latest) {
      latest = day;
    }
  }
  return latest == null ? null : today - latest;
}
