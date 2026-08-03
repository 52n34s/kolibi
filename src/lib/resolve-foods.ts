import { createRowItemId } from '@/components/scan/meal-item-row-model';
import { supabase } from '@/lib/supabase';
import {
  getItemTotalGrams,
  visionItemToEditable,
  type EditableMealItem,
  type VisionFoodItem,
} from '@/services/mealVision/types';

export type ResolvedFoodRow = {
  query_name: string;
  food_id: string;
  names: Record<string, string> | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

function resolveLanguageCode(language: string): string {
  return language.split('-')[0]?.toLowerCase() ?? 'en';
}

function resolveLocalizedName(
  names: Record<string, string> | null | undefined,
  languageCode: string,
  fallbackName: string,
): string {
  const lang = resolveLanguageCode(languageCode);
  const localized = names?.[lang]?.trim();
  if (localized) {
    return localized;
  }

  const english = names?.en?.trim();
  if (english) {
    return english;
  }

  return fallbackName;
}

function lookupResolution(
  byQueryName: Map<string, ResolvedFoodRow>,
  canonicalName: string,
): ResolvedFoodRow | undefined {
  return byQueryName.get(canonicalName) ?? byQueryName.get(canonicalName.toLowerCase());
}

/**
 * Derive kcal/100g from model kcal + grams for unmatched vision items.
 * Works for both weight-based and countable items: for countable items
 * quantityGrams is already count × gramsPerUnit (only set when gramsPerUnit > 0).
 * Invalid or missing grams (incl. estimated_grams_per_unit = 0) yield null.
 */
export function deriveKcalPer100gFromModel(item: EditableMealItem): number | null {
  const grams = item.quantityGrams;
  if (grams == null || grams <= 0) {
    return null;
  }

  if (!(item.kcal > 0)) {
    return null;
  }

  return (item.kcal / grams) * 100;
}

/** One RPC for all names. Throws on transport/RPC errors (caller may swallow). */
export async function resolveFoodsByNames(
  names: string[],
): Promise<Map<string, ResolvedFoodRow>> {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0)),
  ];
  const byQueryName = new Map<string, ResolvedFoodRow>();

  if (unique.length === 0) {
    return byQueryName;
  }

  const { data, error } = await supabase.rpc('resolve_foods', {
    p_names: unique,
  });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as ResolvedFoodRow[]) {
    if (!row?.query_name || !row?.food_id) {
      continue;
    }

    byQueryName.set(row.query_name, row);
    byQueryName.set(row.query_name.toLowerCase(), row);
  }

  return byQueryName;
}

/**
 * Maps vision items to editable meal items and enriches matches from foods via
 * a single resolve_foods call. On RPC failure, returns unenriched items
 * (still with derived kcalPer100g where possible).
 */
export async function enrichVisionItemsWithResolvedFoods(
  items: VisionFoodItem[],
  languageCode: string,
): Promise<EditableMealItem[]> {
  let resolutions = new Map<string, ResolvedFoodRow>();

  try {
    resolutions = await resolveFoodsByNames(items.map((item) => item.canonical_name));
  } catch (error) {
    console.warn('[resolve-foods] resolve_foods failed, continuing without enrichment:', error);
  }

  return items.map((item) => {
    const editable = visionItemToEditable(item, createRowItemId());
    const match = lookupResolution(resolutions, item.canonical_name);

    if (match) {
      const kcalPer100g = Number(match.kcal_per_100g);
      if (!Number.isFinite(kcalPer100g) || kcalPer100g <= 0) {
        return {
          ...editable,
          foodId: match.food_id,
          name: resolveLocalizedName(match.names, languageCode, item.name),
        };
      }

      const grams = getItemTotalGrams(editable);
      const kcal =
        grams > 0 ? Math.max(0, Math.round((kcalPer100g / 100) * grams)) : editable.kcal;

      return {
        ...editable,
        foodId: match.food_id,
        kcalPer100g,
        kcalPer100gSource: 'database',
        name: resolveLocalizedName(match.names, languageCode, item.name),
        kcal,
        baselineKcal: kcal,
      };
    }

    const derivedKcalPer100g = deriveKcalPer100gFromModel(editable);
    if (derivedKcalPer100g == null) {
      return editable;
    }

    return {
      ...editable,
      foodId: null,
      kcalPer100g: derivedKcalPer100g,
      kcalPer100gSource: 'derived',
    };
  });
}
