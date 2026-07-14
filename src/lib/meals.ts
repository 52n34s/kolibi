import { localDayWindow, localDateKey } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';
import {
  includeMealInCalibration,
  MEAL_SOURCE,
  type MealSource,
} from '@/lib/meal-sources';
import type { UnitSystem } from '@/lib/unit-system';
import { gramsToOz, mlToFlOz } from '@/lib/units';
import {
  getBaselineTotalGrams,
  getItemTotalGrams,
  wasMealItemEdited,
  wasQuantityUserCorrected,
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

function normalizeKcalPer100g(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeFoodName(canonicalName: string | undefined): string {
  return (canonicalName ?? '').trim().toLowerCase();
}

function isFreeCountItem(item: EditableMealItem): boolean {
  return (
    item.origin === 'manual' &&
    item.quantityCount != null &&
    item.quantityCount > 0 &&
    normalizeKcalPer100g(item.kcalPer100g) == null
  );
}

function isCountBasedItem(item: EditableMealItem): boolean {
  if (item.quantityCount == null || item.quantityCount <= 0) {
    return false;
  }

  if (item.origin === 'manual') {
    return isFreeCountItem(item) || (item.gramsPerUnit != null && item.gramsPerUnit > 0);
  }

  return item.gramsPerUnit != null && item.gramsPerUnit > 0;
}

function isItemQuantityValid(item: EditableMealItem): boolean {
  if (isFreeCountItem(item)) {
    return true;
  }

  if (isCountBasedItem(item)) {
    return item.gramsPerUnit != null && item.gramsPerUnit > 0;
  }

  return getItemTotalGrams(item) > 0;
}

type FoodAdjustmentRow = {
  user_id: string;
  meal_item_id: string;
  food_name_normalized: string;
  food_id: string | null;
  ai_estimated_grams: number;
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

  const edited = wasQuantityUserCorrected(item);

  return {
    user_id: params.userId,
    meal_item_id: insertedItem.id,
    food_name_normalized: normalizeFoodName(item.canonicalName),
    food_id: item.foodId ?? null,
    ai_estimated_grams: aiEstimatedGrams,
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
  const hasKnownPieceWeight =
    isCountItem && item.gramsPerUnit != null && item.gramsPerUnit > 0;
  const gramsPerUnit = hasKnownPieceWeight ? item.gramsPerUnit : null;
  const quantityGrams = isCountItem
    ? hasKnownPieceWeight
      ? (count ?? 0) * (gramsPerUnit ?? 0)
      : 0
    : (item.quantityGrams ?? 0);
  const displayUnit: 'g' | 'ml' = isCountItem ? 'g' : item.displayUnit;

  return {
    meal_id: params.mealId,
    user_id: params.userId,
    name: (item.name ?? '').trim(),
    quantity_type: quantityType,
    quantity_grams: quantityGrams,
    count,
    grams_per_unit: gramsPerUnit,
    display_unit: displayUnit,
    kcal: item.kcal,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    ai_estimated_grams: getBaselineTotalGrams(item),
    portion_factor: 1,
    was_ai_generated: item.origin === 'ai',
    was_edited: wasMealItemEdited(item),
    sort_order: params.sortOrder,
    kcal_per_100g: normalizeKcalPer100g(item.kcalPer100g),
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
    if (!isItemQuantityValid(item)) {
      const error = new Error(
        `Invalid quantity for ingredient "${(item.name ?? '').trim()}".`,
      );
      console.error('[saveScannedMeal] validation failed before insert:', error.message, {
        origin: item.origin,
        quantityGrams: item.quantityGrams,
        quantityCount: item.quantityCount,
        gramsPerUnit: item.gramsPerUnit,
        kcalPer100g: item.kcalPer100g,
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

export async function fetchTodayConsumedCalories(userId: string): Promise<number> {
  const { startISO, endISO } = localDayWindow();

  const { data, error } = await supabase
    .from('meals')
    .select('total_kcal')
    .eq('user_id', userId)
    .gte('eaten_at', startISO)
    .lt('eaten_at', endISO);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, meal) => sum + Number(meal.total_kcal ?? 0), 0);
}

export type TodayMealItem = {
  id: string;
  name: string;
  kcal: number;
  quantity_grams: number;
  quantity_type: MealItemQuantityType;
  count: number | null;
  grams_per_unit: number | null;
  display_unit: 'g' | 'ml';
  kcal_per_100g: number | null;
  sort_order: number;
};

export type TodayMeal = {
  id: string;
  eaten_at: string;
  total_kcal: number;
  total_quantity_grams: number;
  items: TodayMealItem[];
};

export async function fetchTodayMeals(userId: string): Promise<TodayMeal[]> {
  const { startISO, endISO } = localDayWindow();

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id, eaten_at, total_kcal')
    .eq('user_id', userId)
    .gte('eaten_at', startISO)
    .lt('eaten_at', endISO)
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
    .select(
      'id, meal_id, name, kcal, quantity_grams, quantity_type, count, grams_per_unit, display_unit, kcal_per_100g, sort_order',
    )
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
      quantity_grams: Number(item.quantity_grams ?? 0),
      quantity_type: (item.quantity_type as MealItemQuantityType) ?? 'grams',
      count: item.count == null ? null : Number(item.count),
      grams_per_unit: item.grams_per_unit == null ? null : Number(item.grams_per_unit),
      display_unit: item.display_unit === 'ml' ? 'ml' : 'g',
      kcal_per_100g:
        item.kcal_per_100g == null ? null : Number(item.kcal_per_100g),
      sort_order: item.sort_order ?? 0,
    });
    itemsByMealId.set(item.meal_id, mealItems);
  }

  return meals.map((meal) => {
    const mealItems = itemsByMealId.get(meal.id) ?? [];
    const total_quantity_grams = mealItems.reduce(
      (sum, item) => sum + item.quantity_grams,
      0,
    );

    return {
      id: meal.id,
      eaten_at: meal.eaten_at,
      total_kcal: Number(meal.total_kcal ?? 0),
      total_quantity_grams,
      items: mealItems,
    };
  });
}

/** Display-only conversion for today-meal quantity labels (storage stays in g/ml). */
function formatStoredMassForDisplay(
  storedAmount: number,
  displayUnit: 'g' | 'ml',
  unitSystem: UnitSystem,
): { amount: number; unit: string } {
  if (unitSystem === 'imperial') {
    if (displayUnit === 'ml') {
      return { amount: mlToFlOz(storedAmount), unit: 'fl oz' };
    }

    return { amount: gramsToOz(storedAmount), unit: 'oz' };
  }

  return { amount: storedAmount, unit: displayUnit };
}

/** Human-readable quantity label for today-meal list rows. */
export function formatTodayMealQuantityLabel(
  meal: TodayMeal,
  t: (key: string, options?: Record<string, unknown>) => string,
  unitSystem: UnitSystem = 'metric',
): string {
  const items = meal.items;

  if (items.length === 0) {
    const { amount, unit } = formatStoredMassForDisplay(0, 'g', unitSystem);
    return t('home.meals.quantityMass', { amount, unit });
  }

  const allCount = items.every((item) => item.quantity_type === 'count');
  if (allCount) {
    const totalCount = items.reduce((sum, item) => sum + (item.count ?? 0), 0);
    return t('home.meals.quantityCount', { count: totalCount });
  }

  const totalCount = items
    .filter((item) => item.quantity_type === 'count')
    .reduce((sum, item) => sum + (item.count ?? 0), 0);

  const allMl = items.every(
    (item) => item.quantity_type === 'grams' && item.display_unit === 'ml',
  );
  if (allMl) {
    const { amount, unit } = formatStoredMassForDisplay(
      meal.total_quantity_grams,
      'ml',
      unitSystem,
    );
    return t('home.meals.quantityMass', { amount, unit });
  }

  if (meal.total_quantity_grams <= 0 && totalCount > 0) {
    return t('home.meals.quantityCount', { count: totalCount });
  }

  const { amount, unit } = formatStoredMassForDisplay(
    meal.total_quantity_grams,
    'g',
    unitSystem,
  );
  return t('home.meals.quantityMass', { amount, unit });
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
  displayUnit?: 'g' | 'ml';
  kcal: number;
  kcalPer100g?: number | null;
  foodId?: string | null;
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
      const linked = normalizeKcalPer100g(entry.kcalPer100g) != null;
      const hasKnownPieceWeight =
        linked &&
        entry.gramsPerUnit != null &&
        Number.isFinite(entry.gramsPerUnit) &&
        entry.gramsPerUnit > 0;
      const gramsPerUnit = hasKnownPieceWeight ? entry.gramsPerUnit : null;
      const totalGrams = hasKnownPieceWeight ? count * (gramsPerUnit ?? 0) : 0;

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
        foodId: entry.foodId ?? null,
        kcalPer100g: normalizeKcalPer100g(entry.kcalPer100g),
        quantitySource: 'user',
        displayUnit: 'g',
      };
    }

    const quantityGrams = entry.amount;
    const displayUnit: 'g' | 'ml' = entry.unit === 'ml' ? 'ml' : 'g';

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
      foodId: entry.foodId ?? null,
      kcalPer100g: normalizeKcalPer100g(entry.kcalPer100g),
      quantitySource: 'user',
      displayUnit,
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
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      return false;
    }

    const linked = normalizeKcalPer100g(entry.kcalPer100g) != null;
    if (linked) {
      return (
        entry.gramsPerUnit != null &&
        Number.isFinite(entry.gramsPerUnit) &&
        entry.gramsPerUnit > 0
      );
    }

    return true;
  }

  return Number.isFinite(entry.amount) && entry.amount > 0;
}

export async function fetchDailyCalorieTotals(params: {
  userId: string;
  days: number;
}): Promise<{ date: string; totalCalories: number }[]> {
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - (params.days - 1));
  const { startISO: since } = localDayWindow(lookbackStart);

  const { data, error } = await supabase
    .from('meals')
    .select('eaten_at, total_kcal')
    .eq('user_id', params.userId)
    .gte('eaten_at', since)
    .order('eaten_at', { ascending: true });

  if (error) {
    throw error;
  }

  const totalsByDate = new Map<string, number>();

  for (const row of data ?? []) {
    const dateKey = localDateKey(new Date(row.eaten_at));
    const previous = totalsByDate.get(dateKey) ?? 0;
    totalsByDate.set(dateKey, previous + Number(row.total_kcal ?? 0));
  }

  const result: { date: string; totalCalories: number }[] = [];

  for (let offset = params.days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const dateKey = localDateKey(date);
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
  display_unit: 'g' | 'ml';
  kcal: number;
  kcal_per_100g: number | null;
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
  const linked = normalizeKcalPer100g(entry.kcalPer100g) != null;
  const hasKnownPieceWeight =
    isCountItem &&
    linked &&
    entry.gramsPerUnit != null &&
    Number.isFinite(entry.gramsPerUnit) &&
    entry.gramsPerUnit > 0;
  const gramsPerUnit = hasKnownPieceWeight ? entry.gramsPerUnit : null;
  const quantityGrams = isCountItem
    ? hasKnownPieceWeight
      ? entry.amount * (gramsPerUnit ?? 0)
      : 0
    : entry.amount;
  const displayUnit: 'g' | 'ml' = isCountItem ? 'g' : entry.displayUnit === 'ml' ? 'ml' : 'g';

  return {
    meal_id: params.mealId,
    user_id: params.userId,
    name: entry.name.trim(),
    quantity_type: quantityType,
    quantity_grams: quantityGrams,
    count,
    grams_per_unit: gramsPerUnit,
    display_unit: displayUnit,
    kcal: entry.kcal,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    ai_estimated_grams: editable.baselineGrams ?? quantityGrams,
    portion_factor: 1,
    was_ai_generated: params.wasAiGenerated,
    was_edited: true,
    sort_order: params.sortOrder,
    kcal_per_100g: normalizeKcalPer100g(entry.kcalPer100g),
  };
}

export async function fetchMealItemsForEdit(
  mealId: string,
  userId: string,
): Promise<MealItemForEdit[]> {
  const { data, error } = await supabase
    .from('meal_items')
    .select(
      'id, name, quantity_type, quantity_grams, count, grams_per_unit, display_unit, kcal, kcal_per_100g, sort_order, was_ai_generated',
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
    display_unit: item.display_unit === 'ml' ? 'ml' : 'g',
    kcal: Number(item.kcal ?? 0),
    kcal_per_100g:
      item.kcal_per_100g == null ? null : Number(item.kcal_per_100g),
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
          display_unit: row.display_unit,
          kcal: row.kcal,
          kcal_per_100g: row.kcal_per_100g,
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

export async function deleteMeal(params: {
  mealId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', params.mealId)
    .eq('user_id', params.userId);

  if (error) {
    throw error;
  }
}
