import type { UnitSystem } from '@/lib/unit-system';

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LBS_PER_KG = 2.2046226218;

/** Meal quantity: stored in DB as grams (ml 1:1). Display conversion only at UI boundary. */
const G_TO_OZ = 0.03527;
const ML_TO_FL_OZ = 0.03381;

export type MealQuantityUnit = 'g' | 'ml' | 'pcs';

export function gramsToOz(grams: number): number {
  return Math.round(grams * G_TO_OZ * 10) / 10;
}

export function ozToGrams(oz: number): number {
  return Math.max(0, Math.round(oz / G_TO_OZ));
}

export function mlToFlOz(ml: number): number {
  return Math.round(ml * ML_TO_FL_OZ * 10) / 10;
}

export function flOzToMl(flOz: number): number {
  return Math.max(0, Math.round(flOz / ML_TO_FL_OZ));
}

/** Convert stored quantity (g/ml/count) to display value for the active unit system. */
export function toDisplay(
  storedQuantity: number,
  unit: MealQuantityUnit,
  unitSystem: UnitSystem,
): number {
  if (unit === 'pcs' || unitSystem === 'metric') {
    return storedQuantity;
  }

  if (unit === 'ml') {
    return mlToFlOz(storedQuantity);
  }

  return gramsToOz(storedQuantity);
}

/** Convert a display value back to stored quantity (grams/ml/count). */
export function fromDisplay(
  displayQuantity: number,
  unit: MealQuantityUnit,
  unitSystem: UnitSystem,
): number {
  if (unit === 'pcs') {
    return Math.max(1, Math.round(displayQuantity));
  }

  if (unitSystem === 'metric') {
    return Math.max(10, Math.round(displayQuantity));
  }

  if (unit === 'ml') {
    return Math.max(1, flOzToMl(displayQuantity));
  }

  return Math.max(1, ozToGrams(displayQuantity));
}

export function formatQuantity(
  storedQuantity: number,
  unit: MealQuantityUnit,
  unitSystem: UnitSystem,
): string {
  const display = toDisplay(storedQuantity, unit, unitSystem);

  if (unit === 'pcs') {
    return String(Math.round(display));
  }

  if (unitSystem === 'imperial') {
    return unit === 'ml' ? `${display} fl oz` : `${display} oz`;
  }

  return unit === 'ml' ? `${display} ml` : `${display} g`;
}

export function getQuantityStep(unit: MealQuantityUnit, unitSystem: UnitSystem): number {
  if (unit === 'pcs') {
    return 1;
  }

  return unitSystem === 'imperial' ? 0.5 : 10;
}

export function getMinDisplayQuantity(unit: MealQuantityUnit, unitSystem: UnitSystem): number {
  if (unit === 'pcs') {
    return 1;
  }

  return unitSystem === 'imperial' ? 0.5 : 10;
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

export function kgToLbs(kg: number): number {
  return Math.round(kg * LBS_PER_KG * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / LBS_PER_KG) * 10) / 10;
}
