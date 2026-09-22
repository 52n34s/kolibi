import type { UnitSystem } from '@/lib/unit-system';

export type MealQuantityUnit = 'g' | 'ml' | 'pcs';

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LBS_PER_KG = 2.2046226218;

/** Meal quantities are always shown and edited as g / ml / pcs (never oz). */
export function toDisplay(
  storedQuantity: number,
  unit: MealQuantityUnit,
  _unitSystem?: UnitSystem,
): number {
  return storedQuantity;
}

/** Meal quantities are always stored as g / ml / count. */
export function fromDisplay(
  displayQuantity: number,
  unit: MealQuantityUnit,
  _unitSystem?: UnitSystem,
): number {
  if (unit === 'pcs') {
    return Math.max(1, Math.round(displayQuantity));
  }

  return Math.max(1, Math.round(displayQuantity));
}

export function formatQuantity(
  storedQuantity: number,
  unit: MealQuantityUnit,
  _unitSystem?: UnitSystem,
): string {
  const display = toDisplay(storedQuantity, unit);

  if (unit === 'pcs') {
    return String(Math.round(display));
  }

  return unit === 'ml' ? `${display} ml` : `${display} g`;
}

export function getQuantityStep(unit: MealQuantityUnit, _unitSystem?: UnitSystem): number {
  if (unit === 'pcs') {
    return 1;
  }

  return 10;
}

export function getMinDisplayQuantity(
  unit: MealQuantityUnit,
  _unitSystem?: UnitSystem,
): number {
  if (unit === 'pcs') {
    return 1;
  }

  return 1;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = Math.round(totalInches - feet * INCHES_PER_FOOT);

  if (inches === INCHES_PER_FOOT) {
    feet += 1;
    inches = 0;
  }

  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * INCHES_PER_FOOT + inches;
  return Math.round(totalInches * CM_PER_INCH);
}

/** Waist circumference: one decimal inch for display. */
export function cmToInches(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * CM_PER_INCH * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * LBS_PER_KG * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / LBS_PER_KG) * 10) / 10;
}
