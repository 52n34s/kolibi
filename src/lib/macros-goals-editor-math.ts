/**
 * Shared math for the combined macros goals editor.
 * When carbs are locked (default), carbs fill the residual of the calorie goal.
 * When unlocked, all three macros are free and the calorie goal is derived from them.
 *
 * Fiber is never part of Atwater calorie identity (P×4 + F×9 + C×4). It is a
 * carbohydrate subset tracked only as a separate minimum, not a calorie term.
 */

export function macrosToKcal(proteinG: number, fatG: number, carbsG: number): number {
  return proteinG * 4 + fatG * 9 + carbsG * 4;
}

/** Residual carbs so protein + fat + carbs match basisKcal (may be negative → invalid). */
export function deriveCarbsG(params: {
  basisKcal: number;
  proteinG: number;
  fatG: number;
}): number {
  return (params.basisKcal - params.proteinG * 4 - params.fatG * 9) / 4;
}

export function deriveCarbsGRounded(params: {
  basisKcal: number;
  proteinG: number;
  fatG: number;
}): number {
  return Math.round(deriveCarbsG(params));
}

export function wouldCarbsGoNegative(params: {
  basisKcal: number;
  proteinG: number;
  fatG: number;
}): boolean {
  return deriveCarbsG(params) < 0;
}

export function kcalFromMacrosRounded(proteinG: number, fatG: number, carbsG: number): number {
  return Math.round(macrosToKcal(proteinG, fatG, carbsG));
}

export type MacroSoftHint = 'protein_low' | 'protein_high' | 'fat_low';

/** Informational only — never blocks save. May return multiple hints. */
export function resolveMacroSoftHints(params: {
  proteinG: number;
  fatG: number;
  basisKcal: number;
  weightKg: number | null;
}): MacroSoftHint[] {
  const hints: MacroSoftHint[] = [];

  if (params.weightKg != null && params.weightKg > 0) {
    const perKg = params.proteinG / params.weightKg;
    if (perKg < 1.0) {
      hints.push('protein_low');
    } else if (perKg > 2.5) {
      hints.push('protein_high');
    }
  }

  if (params.basisKcal > 0 && (params.fatG * 9) / params.basisKcal < 0.2) {
    hints.push('fat_low');
  }

  return hints;
}

/** @deprecated Prefer resolveMacroSoftHints — kept for call sites that need one. */
export function resolveMacroSoftHint(params: {
  proteinG: number;
  fatG: number;
  basisKcal: number;
  weightKg: number | null;
}): MacroSoftHint | null {
  return resolveMacroSoftHints(params)[0] ?? null;
}

export function isMacroValueDiverged(actual: number, recommended: number): boolean {
  return Math.round(actual) !== Math.round(recommended);
}

export const MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY = 'macros_adapt_to_training';
export const MACROS_CARBS_UNLOCKED_PREFERENCE_KEY = 'macros_carbs_unlocked';

/** Same tolerance as sport-macro-scaling (±2 kcal for identity checks). */
export const MACRO_KCAL_TOLERANCE = 2;
