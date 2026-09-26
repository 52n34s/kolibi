import { resolveLanguageCode } from '@/lib/food-name-search';
import { supabase } from '@/lib/supabase';

import type { BalanceNutrient } from '@/lib/history-balance-stats';

export {
  accuracyFromProteinDistributionDays,
  accuracyFromTrackedDays,
  accuracyFromWeighIns,
  computeBalanceStats,
  computeBalanceSummaryHeadline,
  CALORIE_UNDERSHOOT_MIN_DAYS,
  computeProteinDistributionStats,
  countCalorieUndershootDays,
  detectRepeatedCalorieUndershoot,
  formatBalanceAccuracyValue,
  pickBalanceAccuracyHint,
  shouldShowWeightChangeDelta,
  TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH,
  type BalanceAccuracy,
  type BalanceAccuracyHintKind,
  type BalanceNutrient,
  type BalanceStats,
  type BalanceSummaryHeadline,
  type BalanceSummaryNutrient,
  type CalorieUndershootDay,
  type ProteinDistributionMeal,
  type ProteinDistributionStats,
} from '@/lib/history-balance-stats';

export type ContributingFood = {
  id: string;
  name: string;
};

const CONTRIBUTING_FOODS_LOOKBACK_DAYS = 30;
const CONTRIBUTING_FOODS_LIMIT = 3;

type MealIdRow = { id: string };
type MealItemFoodIdRow = { food_id: string | null };
type FoodNutrientRow = {
  id: string;
  name: string;
  names: Record<string, string> | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
};

function resolveFoodName(row: FoodNutrientRow, languageCode: string): string {
  const lang = resolveLanguageCode(languageCode);
  const localized = row.names?.[lang];
  if (localized && localized.trim().length > 0) {
    return localized.trim();
  }
  const english = row.names?.en;
  if (english && english.trim().length > 0) {
    return english.trim();
  }
  return row.name.trim();
}

function per100gForNutrient(row: FoodNutrientRow, nutrient: BalanceNutrient): number | null {
  if (nutrient === 'protein') {
    return row.protein_per_100g;
  }
  if (nutrient === 'fiber') {
    return row.fiber_per_100g;
  }
  return row.fat_per_100g;
}

/**
 * The user's own foods (last 30 days, independent of the selected 7/30 range)
 * ranked by (nutrient per 100g) × (how often the food was logged).
 */
export async function fetchTopContributingFoods(
  userId: string,
  nutrient: BalanceNutrient,
  languageCode: string,
): Promise<ContributingFood[]> {
  const since = new Date();
  since.setDate(since.getDate() - CONTRIBUTING_FOODS_LOOKBACK_DAYS);

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id')
    .eq('user_id', userId)
    .gte('eaten_at', since.toISOString());
  if (mealsError) {
    throw mealsError;
  }

  const mealIds = ((meals ?? []) as MealIdRow[]).map((row) => row.id);
  if (mealIds.length === 0) {
    return [];
  }

  const { data: items, error: itemsError } = await supabase
    .from('meal_items')
    .select('food_id')
    .in('meal_id', mealIds)
    .not('food_id', 'is', null);
  if (itemsError) {
    throw itemsError;
  }

  const frequencyByFoodId = new Map<string, number>();
  for (const row of (items ?? []) as MealItemFoodIdRow[]) {
    if (!row.food_id) {
      continue;
    }
    frequencyByFoodId.set(row.food_id, (frequencyByFoodId.get(row.food_id) ?? 0) + 1);
  }
  if (frequencyByFoodId.size === 0) {
    return [];
  }

  const { data: foods, error: foodsError } = await supabase
    .from('foods')
    .select('id, name, names, protein_per_100g, fat_per_100g, fiber_per_100g')
    .in('id', [...frequencyByFoodId.keys()]);
  if (foodsError) {
    throw foodsError;
  }

  const scored = ((foods ?? []) as FoodNutrientRow[])
    .map((row) => {
      const per100g = per100gForNutrient(row, nutrient);
      const frequency = frequencyByFoodId.get(row.id) ?? 0;
      return {
        id: row.id,
        name: resolveFoodName(row, languageCode),
        score: (per100g ?? 0) * frequency,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const seenNames = new Set<string>();
  const result: ContributingFood[] = [];
  for (const entry of scored) {
    if (seenNames.has(entry.name)) {
      continue;
    }
    seenNames.add(entry.name);
    result.push({ id: entry.id, name: entry.name });
    if (result.length >= CONTRIBUTING_FOODS_LIMIT) {
      break;
    }
  }
  return result;
}
