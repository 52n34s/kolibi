import {
  getBaselineTotalGrams,
  getItemTotalGrams,
  wasQuantityUserCorrected,
  type EditableMealItem,
} from '@/services/mealVision/types';

export type InsertedMealItemRow = {
  id: string;
  sort_order: number;
};

export type FoodAdjustmentRow = {
  user_id: string;
  meal_item_id: string;
  food_name_normalized: string;
  food_id: string | null;
  ai_estimated_grams: number;
  corrected_grams: number;
  include_in_calibration: boolean;
};

export function normalizeFoodName(canonicalName: string | undefined): string {
  return (canonicalName ?? '').trim().toLowerCase();
}

export function buildFoodAdjustmentRow(
  item: EditableMealItem,
  insertedItem: InsertedMealItemRow,
  params: { userId: string; includeInCalibration: boolean },
): FoodAdjustmentRow | null {
  // Label densities are transcribed, not estimated — nothing to calibrate against.
  if (item.kcalPer100gSource === 'label') {
    return null;
  }

  if (item.origin !== 'ai') {
    return null;
  }

  const aiEstimatedGrams = getBaselineTotalGrams(item);

  if (aiEstimatedGrams <= 0) {
    console.warn(
      '[recordFoodAdjustments] skipping item without AI baseline grams:',
      item.canonicalName,
    );
    return null;
  }

  const finalGrams = getItemTotalGrams(item);

  if (finalGrams <= 0) {
    console.warn(
      '[recordFoodAdjustments] skipping item with invalid final grams:',
      item.canonicalName,
    );
    return null;
  }

  // Only real quantity corrections — Ratio-1 (unedited AI) rows dilute avg_ratio.
  if (!wasQuantityUserCorrected(item) || finalGrams === aiEstimatedGrams) {
    return null;
  }

  return {
    user_id: params.userId,
    meal_item_id: insertedItem.id,
    food_name_normalized: normalizeFoodName(item.canonicalName),
    food_id: item.foodId ?? null,
    ai_estimated_grams: aiEstimatedGrams,
    corrected_grams: finalGrams,
    include_in_calibration: params.includeInCalibration,
  };
}
