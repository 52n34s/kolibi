import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';
import { supabase } from '@/lib/supabase';

const OFF_FOOD_SOURCE = 'openfoodfacts';

type FoodInsertRow = {
  name: string;
  name_normalized: string;
  source: typeof OFF_FOOD_SOURCE;
  source_ref: string;
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

function buildFoodInsertRow(product: FoodSearchProduct): FoodInsertRow {
  const row: FoodInsertRow = {
    name: product.name.trim(),
    name_normalized: normalizeFoodName(product.name),
    source: OFF_FOOD_SOURCE,
    source_ref: product.offId,
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

async function lookupFoodIdBySourceRef(sourceRef: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('foods')
    .select('id')
    .eq('source', OFF_FOOD_SOURCE)
    .eq('source_ref', sourceRef)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export async function resolveFoodIdForOffProduct(
  product: FoodSearchProduct,
): Promise<string | null> {
  try {
    const existingId = await lookupFoodIdBySourceRef(product.offId);
    if (existingId) {
      return existingId;
    }

    const insertRow = buildFoodInsertRow(product);
    const { data: inserted, error: insertError } = await supabase
      .from('foods')
      .insert(insertRow)
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return lookupFoodIdBySourceRef(product.offId);
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
