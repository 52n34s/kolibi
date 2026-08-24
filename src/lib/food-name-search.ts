import { supabase } from '@/lib/supabase';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

const SEARCH_RESULT_LIMIT = 15;

type FoodSearchRow = {
  id: string;
  name: string;
  name_normalized: string | null;
  names: Record<string, string> | null;
  search_terms: string[] | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  fiber_per_100g: number | null;
  category: string | null;
};

function resolveLanguageCode(language: string): string {
  return language.split('-')[0]?.toLowerCase() ?? 'en';
}

function resolveDisplayName(row: FoodSearchRow, languageCode: string): string {
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

function mapFoodRowToSearchProduct(
  row: FoodSearchRow,
  languageCode: string,
): FoodSearchProduct {
  return {
    offId: row.id,
    foodId: row.id,
    name: resolveDisplayName(row, languageCode),
    brand: null,
    kcalPer100g: Number(row.kcal_per_100g),
    proteinPer100g: Number(row.protein_per_100g),
    fatPer100g: Number(row.fat_per_100g),
    carbsPer100g: Number(row.carbs_per_100g),
    fiberPer100g: row.fiber_per_100g == null ? null : Number(row.fiber_per_100g),
    sugarPer100g: null,
    sodiumPer100g: null,
    servingSizeGrams: null,
    servingSizeLabel: null,
    category: row.category,
  };
}

export async function searchFoodsByName(
  query: string,
  languageCode: string,
): Promise<FoodSearchProduct[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return [];
  }

  const { data, error } = await supabase.rpc('search_foods', {
    p_query: trimmedQuery,
    p_limit: SEARCH_RESULT_LIMIT,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FoodSearchRow[]).map((row) =>
    mapFoodRowToSearchProduct(row, languageCode),
  );
}
