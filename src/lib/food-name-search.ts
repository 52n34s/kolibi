import { supabase } from '@/lib/supabase';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

const SEARCH_RESULT_LIMIT = 15;
const FOODS_SELECT_COLUMNS =
  'id, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category';

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

function rowMatchesQuery(row: FoodSearchRow, normalizedQuery: string): boolean {
  if (row.name.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (row.name_normalized?.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (row.search_terms?.some((term) => term.toLowerCase().includes(normalizedQuery))) {
    return true;
  }

  if (row.names) {
    return Object.values(row.names).some((name) =>
      name.toLowerCase().includes(normalizedQuery),
    );
  }

  return false;
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
    fiberPer100g: null,
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
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 3) {
    return [];
  }

  const { data, error } = await supabase
    .from('foods')
    .select(FOODS_SELECT_COLUMNS)
    .eq('is_verified', true)
    .eq('source', 'usda_sr28');

  if (error) {
    throw error;
  }

  return ((data ?? []) as FoodSearchRow[])
    .filter((row) => rowMatchesQuery(row, normalizedQuery))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((row) => mapFoodRowToSearchProduct(row, languageCode));
}
