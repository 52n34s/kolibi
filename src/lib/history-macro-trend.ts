export type HistoryMacroNutrient = 'protein' | 'carbs' | 'fat' | 'fiber';

export const HISTORY_MACRO_NUTRIENTS: HistoryMacroNutrient[] = [
  'protein',
  'carbs',
  'fat',
  'fiber',
];

type MacroGrams = {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export type HistoryMacroDay = {
  macros: MacroGrams;
  goal: MacroGrams | null;
  scaledGoal: MacroGrams | null;
};

function gramsFor(
  macros: MacroGrams | null | undefined,
  nutrient: HistoryMacroNutrient,
): number | null {
  if (macros == null) {
    return null;
  }
  switch (nutrient) {
    case 'protein':
      return macros.proteinG;
    case 'carbs':
      return macros.carbsG;
    case 'fat':
      return macros.fatG;
    case 'fiber':
      return macros.fiberG;
  }
}

/** Logged intake; null on days without meals so the line does not drop to 0 g. */
export function historyMacroActualSeries(
  days: readonly HistoryMacroDay[],
  nutrient: HistoryMacroNutrient,
): Array<number | null> {
  return days.map((day) => gramsFor(day.macros, nutrient));
}

/**
 * Goal line for that calendar day: sport-scaled carbs/fat when present,
 * otherwise the calorie_goals row as of that date. Protein and fiber are not
 * training-scaled, so their series is flat unless the stored goal changed.
 * Scaling is reconstructed at read time with the current adapt-to-training
 * preference and current weight — see fetchHistoryData.
 */
export function historyMacroGoalSeries(
  days: readonly HistoryMacroDay[],
  nutrient: HistoryMacroNutrient,
): Array<number | null> {
  return days.map((day) => {
    const scaled = gramsFor(day.scaledGoal, nutrient);
    if (scaled != null) {
      return scaled;
    }
    return gramsFor(day.goal, nutrient);
  });
}
