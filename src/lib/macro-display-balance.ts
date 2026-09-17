/**
 * Keeps the four macro bars adding up to the calorie number above them.
 *
 * The daily goal floor lifts the displayed target without touching the stored
 * base, so the stored macros would otherwise sum to less than the number on
 * screen — a user could fill every bar and still sit hundreds of kcal below it.
 *
 * Protein never moves: it is prescribed per kg, not per calorie.
 * Carbohydrate is the remainder, bounded on both sides — the 10 g/kg cap sends
 * overflow to fat, and below 2 g/kg fat gives calories back to the remainder so
 * a quiet day is not turned into a low-carb day. Both carbohydrate bounds sit on
 * body mass, fat's own 0.7 g/kg floor on the leaner reference mass; fat only
 * gives what it can spare above that floor. At a deficit target, protein plus
 * the fat floor can already account for most of the calories and 2 g/kg is then
 * out of reach — the sum matching the shown number wins over reaching it.
 */

import { FAT_G_PER_KG_FLOOR } from './macro-rules';
import {
  MACRO_KCAL_TOLERANCE,
  MAX_CARBS_G_PER_KG_BODY_WEIGHT,
  MIN_CARBS_G_PER_KG_BODY_WEIGHT,
} from './sport-macro-scaling';

export type BalancedMacroGoals = {
  proteinG: number;
  fatG: number;
  carbsG: number;
};

function macroKcal(proteinG: number, fatG: number, carbsG: number): number {
  return proteinG * 4 + fatG * 9 + carbsG * 4;
}

export function balanceMacroGoalsToCalories(params: {
  targetKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Body mass for the carbohydrate bounds; null drops them. */
  bodyWeightKg: number | null;
  /** Leaner reference mass for the fat floor; null drops it. */
  refWeightKg: number | null;
}): BalancedMacroGoals {
  const { targetKcal, proteinG } = params;
  const current = macroKcal(proteinG, params.fatG, params.carbsG);

  if (
    !(targetKcal > 0) ||
    Math.abs(targetKcal - current) <= MACRO_KCAL_TOLERANCE
  ) {
    return { proteinG: params.proteinG, fatG: params.fatG, carbsG: params.carbsG };
  }

  const body =
    params.bodyWeightKg != null && params.bodyWeightKg > 0 ? params.bodyWeightKg : null;
  const ref = params.refWeightKg != null && params.refWeightKg > 0 ? params.refWeightKg : null;
  const maxCarbsG = body == null ? Number.POSITIVE_INFINITY : MAX_CARBS_G_PER_KG_BODY_WEIGHT * body;
  const minCarbsG = body == null ? 0 : MIN_CARBS_G_PER_KG_BODY_WEIGHT * body;
  const minFatG = ref == null ? 0 : FAT_G_PER_KG_FLOOR * ref;

  let fatG = params.fatG;
  let carbsG = Math.max(0, (targetKcal - proteinG * 4 - fatG * 9) / 4);

  if (carbsG > maxCarbsG) {
    fatG += ((carbsG - maxCarbsG) * 4) / 9;
    carbsG = maxCarbsG;
  } else if (carbsG < minCarbsG) {
    // Move calories from fat into the remainder, but only what fat can spare
    // above its own floor. Moving kcal keeps the sum exact; forcing the full
    // 2 g/kg would push the bars past the number they are meant to explain.
    const wantedKcal = (minCarbsG - carbsG) * 4;
    const sparableKcal = Math.max(0, fatG - minFatG) * 9;
    const movedKcal = Math.min(wantedKcal, sparableKcal);
    carbsG += movedKcal / 4;
    fatG -= movedKcal / 9;
  }

  const fatRounded = Math.max(0, Math.round(fatG));
  const errorFor = (carbs: number) => Math.abs(macroKcal(proteinG, fatRounded, carbs) - targetKcal);
  // The 2 g/kg minimum is a target for the transfer above, never a hard clamp —
  // clamping here would re-inflate the remainder past the calories it explains.
  const lowerBound = 0;
  const upperBound = Math.round(maxCarbsG);

  let carbsRounded = Math.min(upperBound, Math.max(lowerBound, Math.round(carbsG)));
  for (const delta of [1, -1]) {
    const candidate = carbsRounded + delta;
    if (candidate < lowerBound || candidate > upperBound) {
      continue;
    }
    if (errorFor(candidate) < errorFor(carbsRounded)) {
      carbsRounded = candidate;
    }
  }

  return { proteinG: Math.round(proteinG), fatG: fatRounded, carbsG: carbsRounded };
}
