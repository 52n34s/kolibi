import { supabase } from '@/lib/supabase';
import {
  includeMealInCalibration,
  MEAL_SOURCE,
  type MealSource,
} from '@/lib/meal-sources';
import {
  getBaselineTotalGrams,
  getItemTotalGrams,
  wasMealItemEdited,
  type EditableMealItem,
} from '@/services/mealVision/types';

// TODO: protein_g / carbs_g / fat_g durch Makro-Schätzung oder DB-Lookup ersetzen.

type SavedMealRow = {
  id: string;
  total_kcal: number;
};

type InsertedMealItemRow = {
  id: string;
  sort_order: number;
};

function scaleNutrientFromPer100g(per100g: number, quantityGrams: number): number {
  return Math.round((per100g / 100) * quantityGrams * 10) / 10;
}

function scaleKcalFromPer100g(kcalPer100g: number, quantityGrams: number): number {
  return Math.max(0, Math.round((kcalPer100g / 100) * quantityGrams));
}

function normalizeFoodName(canonicalName: string | undefined): string {
  return (canonicalName ?? '').trim().toLowerCase();
}

function isCountBasedItem(item: EditableMealItem): boolean {
  return (
    item.quantityCount != null &&
    item.gramsPerUnit != null &&
    item.gramsPerUnit > 0
  );
}

type FoodAdjustmentRow = {
  user_id: string;
  meal_item_id: string;
  food_name_normalized: string;
  food_id: null;
  adjustment_ratio: number;
  corrected_grams: number;
  include_in_calibration: boolean;
};

function buildFoodAdjustmentRow(
  item: EditableMealItem,
  insertedItem: InsertedMealItemRow,
  params: { userId: string; includeInCalibration: boolean },
): FoodAdjustmentRow | null {
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

  const edited = wasMealItemEdited(item);

  return {
    user_id: params.userId,
    meal_item_id: insertedItem.id,
    food_name_normalized: normalizeFoodName(item.canonicalName),
    food_id: null,
    adjustment_ratio: edited ? finalGrams / aiEstimatedGrams : 1,
    corrected_grams: edited ? finalGrams : aiEstimatedGrams,
    include_in_calibration: params.includeInCalibration,
  };
}

async function insertMealAndReload(
  userId: string,
  source: MealSource,
): Promise<SavedMealRow> {
  const { data: mealRow, error: mealError } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      eaten_at: new Date().toISOString(),
      source,
    })
    .select('id')
    .single();

  if (mealError) {
    throw mealError;
  }

  return mealRow as SavedMealRow;
}

async function reloadMealTotals(mealId: string): Promise<SavedMealRow> {
  const { data: refreshedMeal, error: refreshError } = await supabase
    .from('meals')
    .select('id, total_kcal')
    .eq('id', mealId)
    .single();

  if (refreshError) {
    throw refreshError;
  }

  return refreshedMeal as SavedMealRow;
}

function buildMealItemPayload(
  item: EditableMealItem,
  params: {
    mealId: string;
    userId: string;
    sortOrder: number;
  },
) {
  const isCountItem = isCountBasedItem(item);
  const quantityType = isCountItem ? 'count' : 'grams';
  const count = isCountItem ? item.quantityCount : null;
  const gramsPerUnit = isCountItem ? item.gramsPerUnit : null;
  const quantityGrams = isCountItem
    ? (count ?? 0) * (gramsPerUnit ?? 0)
    : (item.quantityGrams ?? 0);

  return {
    meal_id: params.mealId,
    user_id: params.userId,
    name: (item.name ?? '').trim(),
    quantity_type: quantityType,
    quantity_grams: quantityGrams,
    count,
    grams_per_unit: gramsPerUnit,
    kcal: item.kcal,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    ai_estimated_grams: getBaselineTotalGrams(item),
    portion_factor: 1,
    was_ai_generated: item.origin === 'ai',
    was_edited: wasMealItemEdited(item),
    sort_order: params.sortOrder,
  };
}

async function recordFoodAdjustments(params: {
  userId: string;
  items: EditableMealItem[];
  insertedItems: InsertedMealItemRow[];
  includeInCalibration: boolean;
}) {
  try {
    const itemsBySortOrder = new Map(
      params.items.map((item, index) => [index, item]),
    );

    const adjustmentRows = params.insertedItems.flatMap((insertedItem) => {
      const item = itemsBySortOrder.get(insertedItem.sort_order);

      if (!item) {
        return [];
      }

      const row = buildFoodAdjustmentRow(item, insertedItem, {
        userId: params.userId,
        includeInCalibration: params.includeInCalibration,
      });

      return row ? [row] : [];
    });

    if (adjustmentRows.length === 0) {
      return;
    }

    const { error } = await supabase.from('user_food_adjustments').insert(adjustmentRows);

    if (error) {
      console.error('[recordFoodAdjustments] failed to persist calibration events:', error);
    }
  } catch (error) {
    console.error('[recordFoodAdjustments] unexpected error:', error);
  }
}

export async function saveScannedMeal(params: {
  userId: string;
  items: EditableMealItem[];
  source: MealSource;
}): Promise<{ mealId: string; totalKcal: number }> {
  const normalizedItems = params.items.filter((item) => (item.name ?? '').trim().length > 0);

  if (normalizedItems.length === 0) {
    const error = new Error('At least one ingredient is required.');
    console.error('[saveScannedMeal] validation failed before insert:', error.message);
    throw error;
  }

  for (const item of normalizedItems) {
    const totalGrams = getItemTotalGrams(item);

    if (totalGrams <= 0) {
      const error = new Error(
        `Invalid quantity for ingredient "${(item.name ?? '').trim()}".`,
      );
      console.error('[saveScannedMeal] validation failed before insert:', error.message, {
        origin: item.origin,
        quantityGrams: item.quantityGrams,
        quantityCount: item.quantityCount,
        gramsPerUnit: item.gramsPerUnit,
        totalGrams,
      });
      throw error;
    }
  }

  const includeInCalibration = includeMealInCalibration(params.source);
  const mealRow = await insertMealAndReload(params.userId, params.source);

  const mealItemsPayload = normalizedItems.map((item, index) =>
    buildMealItemPayload(item, {
      mealId: mealRow.id,
      userId: params.userId,
      sortOrder: index,
    }),
  );

  const { data: insertedItems, error: itemsError } = await supabase
    .from('meal_items')
    .insert(mealItemsPayload)
    .select('id, sort_order');

  if (itemsError) {
    await supabase.from('meals').delete().eq('id', mealRow.id);
    throw itemsError;
  }

  try {
    await recordFoodAdjustments({
      userId: params.userId,
      items: normalizedItems,
      insertedItems: (insertedItems ?? []) as InsertedMealItemRow[],
      includeInCalibration,
    });
  } catch (adjustmentError) {
    console.error('[saveScannedMeal] calibration write failed (meal kept):', adjustmentError);
  }

  const savedMeal = await reloadMealTotals(mealRow.id);

  return {
    mealId: savedMeal.id,
    totalKcal: Number(savedMeal.total_kcal ?? 0),
  };
}

export async function saveBarcodeMeal(params: {
  userId: string;
  productName: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  quantityGrams: number;
}): Promise<{ mealId: string; totalKcal: number }> {
  if ((params.productName ?? '').trim().length === 0) {
    const error = new Error('Product name is required.');
    console.error('[saveBarcodeMeal] validation failed before insert:', error.message);
    throw error;
  }

  if (params.quantityGrams <= 0) {
    const error = new Error('Quantity must be greater than zero.');
    console.error('[saveBarcodeMeal] validation failed before insert:', error.message);
    throw error;
  }

  const mealRow = await insertMealAndReload(params.userId, MEAL_SOURCE.BARCODE);

  const { error: itemsError } = await supabase.from('meal_items').insert({
    meal_id: mealRow.id,
    user_id: params.userId,
    name: (params.productName ?? '').trim(),
    quantity_type: 'grams',
    quantity_grams: params.quantityGrams,
    count: null,
    grams_per_unit: null,
    kcal: scaleKcalFromPer100g(params.kcalPer100g, params.quantityGrams),
    protein_g: scaleNutrientFromPer100g(params.proteinPer100g, params.quantityGrams),
    carbs_g: scaleNutrientFromPer100g(params.carbsPer100g, params.quantityGrams),
    fat_g: scaleNutrientFromPer100g(params.fatPer100g, params.quantityGrams),
    ai_estimated_grams: null,
    portion_factor: 1,
    was_ai_generated: false,
    was_edited: false,
    sort_order: 0,
  });

  if (itemsError) {
    await supabase.from('meals').delete().eq('id', mealRow.id);
    throw itemsError;
  }

  const savedMeal = await reloadMealTotals(mealRow.id);

  return {
    mealId: savedMeal.id,
    totalKcal: Number(savedMeal.total_kcal ?? 0),
  };
}

function getUtcDayBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function fetchTodayConsumedCalories(userId: string): Promise<number> {
  const { start, end } = getUtcDayBounds();

  const { data, error } = await supabase
    .from('meals')
    .select('total_kcal')
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, meal) => sum + Number(meal.total_kcal ?? 0), 0);
}

export type TodayMealItem = {
  id: string;
  name: string;
  kcal: number;
  sort_order: number;
};

export type TodayMeal = {
  id: string;
  eaten_at: string;
  total_kcal: number;
  items: TodayMealItem[];
};

export async function fetchTodayMeals(userId: string): Promise<TodayMeal[]> {
  const { start, end } = getUtcDayBounds();

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id, eaten_at, total_kcal')
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end)
    .order('eaten_at', { ascending: false });

  if (mealsError) {
    throw mealsError;
  }

  if (!meals?.length) {
    return [];
  }

  const mealIds = meals.map((meal) => meal.id);

  const { data: items, error: itemsError } = await supabase
    .from('meal_items')
    .select('id, meal_id, name, kcal, sort_order')
    .in('meal_id', mealIds)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const itemsByMealId = new Map<string, TodayMealItem[]>();

  for (const item of items ?? []) {
    const mealItems = itemsByMealId.get(item.meal_id) ?? [];
    mealItems.push({
      id: item.id,
      name: (item.name ?? '').trim(),
      kcal: Number(item.kcal ?? 0),
      sort_order: item.sort_order ?? 0,
    });
    itemsByMealId.set(item.meal_id, mealItems);
  }

  return meals.map((meal) => ({
    id: meal.id,
    eaten_at: meal.eaten_at,
    total_kcal: Number(meal.total_kcal ?? 0),
    items: itemsByMealId.get(meal.id) ?? [],
  }));
}

/** Live Postgres enum `quantity_type`: `grams` | `count` (no separate `ml`). */
export type MealItemQuantityType = 'grams' | 'count';

export type ManualMealEntryUnit = 'grams' | 'ml' | 'count';

export type ManualMealEntryInput = {
  id: string;
  name: string;
  unit: ManualMealEntryUnit;
  amount: number;
  gramsPerUnit: number | null;
  kcal: number;
};

/**
 * Maps manual home-screen entries to EditableMealItem for saveScannedMeal.
 * `ml` has no DB enum value — stored as quantity_type `grams` with quantity_grams = ml
 * (1:1 simplification; liquid density is ignored).
 */
export function mapManualMealEntriesToEditableItems(
  entries: ManualMealEntryInput[],
): EditableMealItem[] {
  return entries.map((entry) => {
    const name = entry.name.trim();

    if (entry.unit === 'count') {
      const count = entry.amount;
      const gramsPerUnit = entry.gramsPerUnit ?? 0;
      const totalGrams = count * gramsPerUnit;

      return {
        id: entry.id,
        name,
        canonicalName: 'custom_ingredient',
        origin: 'manual',
        quantityGrams: totalGrams,
        quantityCount: count,
        gramsPerUnit,
        kcal: entry.kcal,
        confidence: 'low',
        baselineGrams: totalGrams,
        baselineCount: count,
        baselineGramsPerUnit: gramsPerUnit,
        baselineKcal: entry.kcal,
      };
    }

    const quantityGrams = entry.amount;

    return {
      id: entry.id,
      name,
      canonicalName: 'custom_ingredient',
      origin: 'manual',
      quantityGrams,
      quantityCount: null,
      gramsPerUnit: null,
      kcal: entry.kcal,
      confidence: 'low',
      baselineGrams: quantityGrams,
      baselineCount: null,
      baselineGramsPerUnit: null,
      baselineKcal: entry.kcal,
    };
  });
}

export function isManualMealEntryValid(entry: ManualMealEntryInput): boolean {
  if (entry.name.trim().length === 0) {
    return false;
  }

  if (!Number.isFinite(entry.kcal) || entry.kcal <= 0) {
    return false;
  }

  if (entry.unit === 'count') {
    return (
      Number.isFinite(entry.amount) &&
      entry.amount > 0 &&
      entry.gramsPerUnit != null &&
      Number.isFinite(entry.gramsPerUnit) &&
      entry.gramsPerUnit > 0
    );
  }

  return Number.isFinite(entry.amount) && entry.amount > 0;
}

export async function fetchDailyCalorieTotals(params: {
  userId: string;
  days: number;
}): Promise<{ date: string; totalCalories: number }[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (params.days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('meals')
    .select('eaten_at, total_kcal')
    .eq('user_id', params.userId)
    .gte('eaten_at', since.toISOString())
    .order('eaten_at', { ascending: true });

  if (error) {
    throw error;
  }

  const totalsByDate = new Map<string, number>();

  for (const row of data ?? []) {
    const dateKey = row.eaten_at.split('T')[0];
    const previous = totalsByDate.get(dateKey) ?? 0;
    totalsByDate.set(dateKey, previous + Number(row.total_kcal ?? 0));
  }

  const result: { date: string; totalCalories: number }[] = [];

  for (let offset = params.days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const dateKey = date.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      totalCalories: totalsByDate.get(dateKey) ?? 0,
    });
  }

  return result;
}

export type MealItemForEdit = {
  id: string;
  name: string;
  quantity_type: MealItemQuantityType;
  quantity_grams: number;
  count: number | null;
  grams_per_unit: number | null;
  kcal: number;
  sort_order: number;
  was_ai_generated: boolean;
};

export type MealItemEditInput = ManualMealEntryInput & {
  mealItemId: string | null;
  wasAiGenerated: boolean;
};

function buildMealItemRowFromManualEntry(
  entry: ManualMealEntryInput,
  params: {
    mealId: string;
    userId: string;
    sortOrder: number;
    wasAiGenerated: boolean;
  },
) {
  const [editable] = mapManualMealEntriesToEditableItems([entry]);
  const isCountItem = entry.unit === 'count';
  const quantityType: MealItemQuantityType = isCountItem ? 'count' : 'grams';
  const count = isCountItem ? entry.amount : null;
  const gramsPerUnit = isCountItem ? entry.gramsPerUnit : null;
  const quantityGrams = isCountItem
    ? entry.amount * (entry.gramsPerUnit ?? 0)
    : entry.amount;

  return {
    meal_id: params.mealId,
    user_id: params.userId,
    name: entry.name.trim(),
    quantity_type: quantityType,
    quantity_grams: quantityGrams,
    count,
    grams_per_unit: gramsPerUnit,
    kcal: entry.kcal,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    ai_estimated_grams: editable.baselineGrams ?? quantityGrams,
    portion_factor: 1,
    was_ai_generated: params.wasAiGenerated,
    was_edited: true,
    sort_order: params.sortOrder,
  };
}

export async function fetchMealItemsForEdit(
  mealId: string,
  userId: string,
): Promise<MealItemForEdit[]> {
  const { data, error } = await supabase
    .from('meal_items')
    .select(
      'id, name, quantity_type, quantity_grams, count, grams_per_unit, kcal, sort_order, was_ai_generated',
    )
    .eq('meal_id', mealId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    name: (item.name ?? '').trim(),
    quantity_type: item.quantity_type as MealItemQuantityType,
    quantity_grams: Number(item.quantity_grams ?? 0),
    count: item.count == null ? null : Number(item.count),
    grams_per_unit: item.grams_per_unit == null ? null : Number(item.grams_per_unit),
    kcal: Number(item.kcal ?? 0),
    sort_order: item.sort_order ?? 0,
    was_ai_generated: Boolean(item.was_ai_generated),
  }));
}

export async function updateMealWithItems(params: {
  mealId: string;
  userId: string;
  items: MealItemEditInput[];
  removedMealItemIds: string[];
}): Promise<{ mealId: string; totalKcal: number }> {
  if (params.items.length === 0) {
    throw new Error('At least one meal item is required');
  }

  if (params.removedMealItemIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('meal_items')
      .delete()
      .in('id', params.removedMealItemIds)
      .eq('meal_id', params.mealId)
      .eq('user_id', params.userId);

    if (deleteError) {
      throw deleteError;
    }
  }

  for (let index = 0; index < params.items.length; index += 1) {
    const item = params.items[index];
    const row = buildMealItemRowFromManualEntry(item, {
      mealId: params.mealId,
      userId: params.userId,
      sortOrder: index,
      wasAiGenerated: item.wasAiGenerated,
    });

    if (item.mealItemId) {
      const { error: updateError } = await supabase
        .from('meal_items')
        .update({
          name: row.name,
          quantity_type: row.quantity_type,
          quantity_grams: row.quantity_grams,
          count: row.count,
          grams_per_unit: row.grams_per_unit,
          kcal: row.kcal,
          was_edited: true,
          sort_order: row.sort_order,
        })
        .eq('id', item.mealItemId)
        .eq('meal_id', params.mealId)
        .eq('user_id', params.userId);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase.from('meal_items').insert(row);

      if (insertError) {
        throw insertError;
      }
    }
  }

  const savedMeal = await reloadMealTotals(params.mealId);

  return {
    mealId: savedMeal.id,
    totalKcal: Number(savedMeal.total_kcal ?? 0),
  };
}
