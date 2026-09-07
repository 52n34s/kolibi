import { supabase } from '@/lib/supabase';
import {
  absoluteMacrosFromPer100g,
  getItemTotalGrams,
  type EditableMealItem,
} from '@/services/mealVision/types';

const MIN_SAMPLE_COUNT = 2;
const MIN_AVG_RATIO = 0.5;
const MAX_AVG_RATIO = 2.0;

type CalibrationRow = {
  food_name_normalized: string;
  sample_count: number;
  avg_ratio: number;
};

function normalizeFoodName(canonicalName: string | undefined): string {
  return (canonicalName ?? '').trim().toLowerCase();
}

function shouldApplyCalibration(row: CalibrationRow): boolean {
  const ratio = Number(row.avg_ratio);
  return (
    row.sample_count >= MIN_SAMPLE_COUNT &&
    Number.isFinite(ratio) &&
    ratio >= MIN_AVG_RATIO &&
    ratio <= MAX_AVG_RATIO
  );
}

function scaleMacrosProportionally(
  item: EditableMealItem,
  fromGrams: number,
  toGrams: number,
): Pick<EditableMealItem, 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'> {
  if (!(fromGrams > 0)) {
    return {
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG,
    };
  }

  const factor = toGrams / fromGrams;
  const scale = (value: number | null): number | null =>
    value == null ? null : value * factor;

  return {
    proteinG: scale(item.proteinG),
    carbsG: scale(item.carbsG),
    fatG: scale(item.fatG),
    fiberG: scale(item.fiberG),
  };
}

function applyRatioToItem(item: EditableMealItem, avgRatio: number): EditableMealItem {
  const aiGrams = getItemTotalGrams(item);
  if (!(aiGrams > 0)) {
    return item;
  }

  const correctedGrams = Math.max(0, Math.round(aiGrams * avgRatio));
  if (correctedGrams === aiGrams) {
    return item;
  }

  const isCountItem =
    item.quantityCount != null &&
    item.quantityCount > 0 &&
    item.gramsPerUnit != null &&
    item.gramsPerUnit > 0;

  const nextQuantity = isCountItem
    ? {
        quantityGrams: correctedGrams,
        gramsPerUnit: correctedGrams / item.quantityCount!,
        baselineGrams: correctedGrams,
        baselineGramsPerUnit: correctedGrams / item.quantityCount!,
      }
    : {
        quantityGrams: correctedGrams,
        baselineGrams: correctedGrams,
      };

  const kcalPer100g = item.kcalPer100g;
  const kcal =
    kcalPer100g != null && kcalPer100g > 0
      ? Math.max(0, Math.round((kcalPer100g / 100) * correctedGrams))
      : Math.max(0, Math.round((correctedGrams / aiGrams) * item.baselineKcal));

  const absoluteMacros =
    item.macrosPer100g != null
      ? absoluteMacrosFromPer100g(item.macrosPer100g, correctedGrams, {
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          fiberG: item.fiberG,
        })
      : scaleMacrosProportionally(item, aiGrams, correctedGrams);

  return {
    ...item,
    ...nextQuantity,
    kcal,
    baselineKcal: kcal,
    // Keep 'ai' so a later user edit still counts as a real correction.
    quantitySource: 'ai',
    proteinG: absoluteMacros.proteinG,
    carbsG: absoluteMacros.carbsG,
    fatG: absoluteMacros.fatG,
    fiberG: absoluteMacros.fiberG,
  };
}

/**
 * Loads the user's food calibration and scales AI gram estimates.
 * Applied only when sample_count >= 3 and avg_ratio is in [0.5, 2.0].
 * quantitySource stays 'ai' (calibrated value is the new AI baseline).
 */
export async function applyUserFoodCalibration(
  userId: string,
  items: EditableMealItem[],
): Promise<EditableMealItem[]> {
  const names = [
    ...new Set(
      items
        .map((item) => normalizeFoodName(item.canonicalName))
        .filter((name) => name.length > 0),
    ),
  ];

  if (names.length === 0) {
    return items;
  }

  const { data, error } = await supabase
    .from('user_food_calibration')
    .select('food_name_normalized, sample_count, avg_ratio')
    .eq('user_id', userId)
    .in('food_name_normalized', names);

  if (error) {
    console.warn('[food-calibration] load failed, continuing without calibration:', error);
    return items;
  }

  const byName = new Map<string, CalibrationRow>();
  for (const row of (data ?? []) as CalibrationRow[]) {
    if (!row?.food_name_normalized) {
      continue;
    }
    byName.set(row.food_name_normalized, row);
  }

  if (byName.size === 0) {
    return items;
  }

  return items.map((item) => {
    const key = normalizeFoodName(item.canonicalName);
    const row = byName.get(key);
    if (!row || !shouldApplyCalibration(row)) {
      return item;
    }

    return applyRatioToItem(item, Number(row.avg_ratio));
  });
}
