import {
  mapFoodRowToSearchProduct,
  type FoodSearchRow,
} from '@/lib/food-name-search';
import { supabase } from '@/lib/supabase';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

/** Rows pulled from top_foods — enough to sort both ways client-side. */
export const FOOD_SUGGESTION_RPC_LIMIT = 30;
/** Below this many usable rows the history is too thin to be worth a dropdown. */
export const FOOD_SUGGESTION_MIN_ROWS = 5;
export const FOOD_SUGGESTION_LIST_LENGTH = 10;

export type FoodSuggestionMode = 'recent' | 'frequent';

type TopFoodsRow = {
  label: string;
  food_id: string | null;
  n: number;
  zuletzt: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  fiber_per_100g: number | null;
};

export type FoodSuggestion = {
  product: FoodSearchProduct;
  usageCount: number;
  lastUsedAt: string;
};

function topFoodsRowToFoodSearchRow(row: TopFoodsRow, foodId: string): FoodSearchRow {
  return {
    id: foodId,
    name: row.label,
    name_normalized: null,
    names: null,
    search_terms: null,
    kcal_per_100g: row.kcal_per_100g,
    protein_per_100g: row.protein_per_100g,
    fat_per_100g: row.fat_per_100g,
    carbs_per_100g: row.carbs_per_100g,
    fiber_per_100g: row.fiber_per_100g,
    category: null,
  };
}

/**
 * The user's own most-logged foods. Rows without a food_id are dropped: without it
 * a tap could not link the row, so they must not count towards FOOD_SUGGESTION_MIN_ROWS.
 */
export async function fetchTopFoods(languageCode: string): Promise<FoodSuggestion[]> {
  const { data, error } = await supabase.rpc('top_foods', {
    p_limit: FOOD_SUGGESTION_RPC_LIMIT,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TopFoodsRow[])
    .filter((row): row is TopFoodsRow & { food_id: string } => row.food_id != null)
    .map((row) => ({
      product: mapFoodRowToSearchProduct(
        topFoodsRowToFoodSearchRow(row, row.food_id),
        languageCode,
      ),
      usageCount: Number(row.n),
      lastUsedAt: row.zuletzt,
    }));
}

export function sortFoodSuggestions(
  suggestions: FoodSuggestion[],
  mode: FoodSuggestionMode,
): FoodSearchProduct[] {
  const sorted = [...suggestions].sort((a, b) =>
    mode === 'recent'
      ? // Parsed, not string-compared: timestamptz can come back with a UTC offset.
        Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt)
      : b.usageCount - a.usageCount,
  );

  return sorted.slice(0, FOOD_SUGGESTION_LIST_LENGTH).map((entry) => entry.product);
}
