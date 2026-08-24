export type NutrientKey = 'protein' | 'carbs' | 'fat' | 'fiber';

/** Stored diet preference values (excluding UI-only `none`). */
export type DietPreference = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';

/**
 * Home nutrient tile order by diet preference.
 * Each diet keeps its own row even while values are identical —
 * iron / B12 will swap per diet later without new branching.
 */
export const HOME_NUTRIENTS: Record<DietPreference | 'none', NutrientKey[]> = {
  none: ['protein', 'carbs', 'fat', 'fiber'],
  omnivore: ['protein', 'carbs', 'fat', 'fiber'],
  pescatarian: ['protein', 'carbs', 'fat', 'fiber'],
  vegetarian: ['protein', 'carbs', 'fat', 'fiber'],
  vegan: ['protein', 'carbs', 'fat', 'fiber'],
};

const DIET_PREFERENCE_SET = new Set<string>([
  'omnivore',
  'pescatarian',
  'vegetarian',
  'vegan',
]);

export function resolveHomeNutrientKeys(
  dietPreference: string | null | undefined,
): NutrientKey[] {
  if (dietPreference != null && DIET_PREFERENCE_SET.has(dietPreference)) {
    return HOME_NUTRIENTS[dietPreference as DietPreference];
  }

  return HOME_NUTRIENTS.none;
}

export type NutrientTileEntry = {
  key: NutrientKey;
  label: string;
  value: number | null;
  unit: string;
};

export function buildHomeNutrientTileEntries(params: {
  dietPreference: string | null | undefined;
  labels: Record<NutrientKey, string>;
  totals: Record<NutrientKey, number | null>;
  unit: string;
}): NutrientTileEntry[] {
  return resolveHomeNutrientKeys(params.dietPreference).map((key) => ({
    key,
    label: params.labels[key],
    value: params.totals[key],
    unit: params.unit,
  }));
}
