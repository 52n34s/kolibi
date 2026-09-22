import type { UnitSystem } from '@/lib/unit-system';
import {
  cmToFeetInches,
  cmToInches,
  feetInchesToCm,
  inchesToCm,
  kgToLbs,
  lbsToKg,
} from '@/lib/units';
import {
  formatWeightDeltaForDisplay,
  formatWeightForDisplay,
  parseWeightInputToKg,
} from '@/lib/weight-parse';

/** Exact statute mile in kilometers. */
const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return Math.round((km / KM_PER_MILE) * 10) / 10;
}

export function milesToKm(mi: number): number {
  return Math.round(mi * KM_PER_MILE * 10) / 10;
}

/** Display number for a stored km value (1 decimal). */
export function distanceKmToDisplay(distanceKm: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'imperial') {
    return kmToMiles(distanceKm);
  }
  return Math.round(distanceKm * 10) / 10;
}

/**
 * Format a stored kilometer value for display.
 * Imperial shows miles (1 decimal).
 */
export function formatDistanceKm(params: {
  distanceKm: number;
  unitSystem: UnitSystem;
  kmLabel: string;
  miLabel: string;
}): string {
  const value = distanceKmToDisplay(params.distanceKm, params.unitSystem);
  if (params.unitSystem === 'imperial') {
    return `${value} ${params.miLabel}`;
  }
  return `${value} ${params.kmLabel}`;
}

/**
 * Parse a distance field into km. Imperial input is treated as miles.
 * Returns null when empty or not a positive number.
 */
export function parseDistanceToKm(params: {
  value: string;
  unitSystem: UnitSystem;
}): number | null {
  const parsed = Number(params.value.replace(',', '.'));
  if (!parsed || parsed <= 0) {
    return null;
  }

  if (params.unitSystem === 'imperial') {
    return milesToKm(parsed);
  }

  return Math.round(parsed * 10) / 10;
}

// Re-exports — weight / length helpers; foods stay g/ml and are not here.
export {
  cmToFeetInches,
  cmToInches,
  feetInchesToCm,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  formatWeightDeltaForDisplay,
  formatWeightForDisplay,
  parseWeightInputToKg,
};
