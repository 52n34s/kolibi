import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';
import { supabase } from '@/lib/supabase';

const OFF_FOOD_SOURCE = 'openfoodfacts';

type FoodNames = {
  de: string;
  en: string;
  es: string;
};

type FoodInsertRow = {
  name: string;
  name_normalized: string;
  names: FoodNames;
  search_terms: string[];
  source: typeof OFF_FOOD_SOURCE;
  source_ref: string;
  created_by: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  is_verified: false;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
  category?: string;
  is_countable?: boolean;
  grams_per_unit?: number;
  unit_label?: string;
};

function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

function buildSearchTerms(...parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    for (const raw of part.toLowerCase().split(/\s+/)) {
      const word = raw.trim();
      if (!word || seen.has(word)) {
        continue;
      }
      seen.add(word);
      terms.push(word);
    }
  }

  return terms;
}

function buildFoodInsertRow(product: FoodSearchProduct, createdBy: string): FoodInsertRow {
  const name = product.name.trim();
  const row: FoodInsertRow = {
    name,
    name_normalized: normalizeFoodName(name),
    names: { de: name, en: name, es: name },
    search_terms: buildSearchTerms(name, product.brand),
    source: OFF_FOOD_SOURCE,
    source_ref: product.offId,
    created_by: createdBy,
    kcal_per_100g: product.kcalPer100g,
    protein_per_100g: product.proteinPer100g,
    carbs_per_100g: product.carbsPer100g,
    fat_per_100g: product.fatPer100g,
    is_verified: false,
  };

  if (product.fiberPer100g != null) {
    row.fiber_per_100g = product.fiberPer100g;
  }

  if (product.sugarPer100g != null) {
    row.sugar_per_100g = product.sugarPer100g;
  }

  if (product.sodiumPer100g != null) {
    row.sodium_per_100g = product.sodiumPer100g;
  }

  if (product.category) {
    row.category = product.category;
  }

  if (product.servingSizeGrams != null) {
    row.is_countable = true;
    row.grams_per_unit = product.servingSizeGrams;
    row.unit_label = product.servingSizeLabel ?? 'serving';
  }

  return row;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user?.id ?? null;
}

async function lookupFoodIdBySourceRef(
  sourceRef: string,
  createdBy: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('foods')
    .select('id')
    .eq('source', OFF_FOOD_SOURCE)
    .eq('source_ref', sourceRef)
    .eq('created_by', createdBy)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export async function resolveFoodIdForOffProduct(
  product: FoodSearchProduct,
): Promise<string | null> {
  if (!Number.isFinite(product.kcalPer100g) || product.kcalPer100g < 0) {
    return null;
  }

  try {
    const createdBy = await getCurrentUserId();
    if (!createdBy) {
      console.error('[FoodsCache] missing auth user for foods insert');
      return null;
    }

    const existingId = await lookupFoodIdBySourceRef(product.offId, createdBy);
    if (existingId) {
      return existingId;
    }

    const insertRow = buildFoodInsertRow(product, createdBy);
    const { data: inserted, error: insertError } = await supabase
      .from('foods')
      .insert(insertRow)
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return lookupFoodIdBySourceRef(product.offId, createdBy);
      }

      console.error('[FoodsCache] insert failed:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        sourceRef: product.offId,
      });
      throw insertError;
    }

    return inserted.id;
  } catch (error) {
    console.error('[FoodsCache] lookup by source/source_ref failed:', {
      source: OFF_FOOD_SOURCE,
      sourceRef: product.offId,
      error,
    });
    throw error;
  }
}
