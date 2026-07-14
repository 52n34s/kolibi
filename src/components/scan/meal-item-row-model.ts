import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';
import {
  getItemTotalGrams,
  type DisplayUnit,
  type EditableMealItem,
  type QuantitySource,
} from '@/services/mealVision/types';

export type MealItemUnit = 'g' | 'ml' | 'pcs';

export type MealItemRowItem = {
  id: string;
  name: string;
  quantity: number;
  kcal: number;
  kcalPer100g: number | null;
  unit: MealItemUnit;
  origin: EditableMealItem['origin'];
  quantitySource: QuantitySource;
  /** Known piece weight in grams — required for pcs; never guessed. */
  gramsPerUnit: number | null;
  foodId?: string | null;
  mealItemId?: string | null;
  wasAiGenerated?: boolean;
};

export const QUANTITY_STEP_G = 10;
export const QUANTITY_STEP_PCS = 1;
export const KCAL_STEP = 10;
export const MIN_QUANTITY_G = 10;
export const MIN_QUANTITY_PCS = 1;
export const MIN_KCAL = 0;
export const DEFAULT_QUANTITY_G = 100;

export function createRowItemId(): string {
  return `meal-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Free manual entry: pcs always allowed. AI/linked items need known piece weight. */
export function isPcsUnitAvailable(item: MealItemRowItem): boolean {
  if (item.origin === 'ai') {
    return item.gramsPerUnit != null && item.gramsPerUnit > 0;
  }

  if (!isLinkedItem(item)) {
    return true;
  }

  return item.gramsPerUnit != null && item.gramsPerUnit > 0;
}

export function isFreeCountRowItem(item: MealItemRowItem): boolean {
  return item.origin === 'manual' && item.unit === 'pcs' && !isLinkedItem(item);
}

export function isLinkedItem(item: MealItemRowItem): boolean {
  return item.kcalPer100g != null && item.kcalPer100g > 0;
}

export function getRowItemTotalGrams(item: MealItemRowItem): number {
  if (item.unit === 'pcs') {
    const gramsPerUnit = item.gramsPerUnit ?? 0;
    return item.quantity * gramsPerUnit;
  }

  return item.quantity;
}

export function rowItemDisplayUnit(item: MealItemRowItem): DisplayUnit {
  return item.unit === 'ml' ? 'ml' : 'g';
}

export function getLinkedMenge(item: MealItemRowItem): number {
  if (item.unit === 'pcs') {
    return getRowItemTotalGrams(item);
  }

  return item.quantity;
}

function applyLinkedMenge(item: MealItemRowItem, menge: number): number {
  const roundedMenge = Math.max(0, Math.round(menge));

  if (item.unit === 'pcs' && item.gramsPerUnit != null && item.gramsPerUnit > 0) {
    return Math.max(MIN_QUANTITY_PCS, Math.round(roundedMenge / item.gramsPerUnit));
  }

  return Math.max(getMinQuantity(item.unit), roundedMenge);
}

export function computeKcalFromQuantity(item: MealItemRowItem): number {
  if (!isLinkedItem(item)) {
    return item.kcal;
  }

  const menge = getLinkedMenge(item);
  if (menge <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((item.kcalPer100g! / 100) * menge));
}

export function computeQuantityFromKcal(item: MealItemRowItem, kcal: number): number {
  if (!isLinkedItem(item) || kcal <= 0) {
    return item.quantity;
  }

  const menge = Math.round((kcal / item.kcalPer100g!) * 100);
  return applyLinkedMenge(item, menge);
}

export function getQuantityStep(unit: MealItemUnit): number {
  return unit === 'pcs' ? QUANTITY_STEP_PCS : QUANTITY_STEP_G;
}

export function getMinQuantity(unit: MealItemUnit): number {
  return unit === 'pcs' ? MIN_QUANTITY_PCS : MIN_QUANTITY_G;
}

export function getDensityUnitLabel(unit: MealItemUnit): 'g' | 'ml' {
  return unit === 'ml' ? 'ml' : 'g';
}

export function createEmptyRowItem(): MealItemRowItem {
  return {
    id: createRowItemId(),
    name: '',
    quantity: DEFAULT_QUANTITY_G,
    kcal: 0,
    kcalPer100g: null,
    unit: 'g',
    origin: 'manual',
    quantitySource: 'user',
    gramsPerUnit: null,
    foodId: null,
  };
}

export function createRowItemFromBarcode(
  product: BarcodeProduct,
  quantityGrams: number,
): MealItemRowItem {
  const kcal = Math.max(
    0,
    Math.round((product.kcalPer100g / 100) * quantityGrams),
  );

  return {
    id: createRowItemId(),
    name: product.productName,
    quantity: quantityGrams,
    kcal,
    kcalPer100g: product.kcalPer100g,
    unit: 'g',
    origin: 'manual',
    quantitySource: 'user',
    gramsPerUnit: product.servingSizeGrams,
    foodId: null,
  };
}

export function changeRowItemQuantity(
  item: MealItemRowItem,
  quantity: number,
): MealItemRowItem {
  const minQuantity = getMinQuantity(item.unit);
  const nextQuantity = Math.max(minQuantity, Math.round(quantity));
  const nextItem = { ...item, quantity: nextQuantity, quantitySource: 'user' as const };

  if (!isLinkedItem(item)) {
    return nextItem;
  }

  return {
    ...nextItem,
    kcal: computeKcalFromQuantity(nextItem),
    kcalPer100g: item.kcalPer100g,
  };
}

export function changeRowItemKcal(item: MealItemRowItem, kcal: number): MealItemRowItem {
  const nextKcal = Math.max(MIN_KCAL, Math.round(kcal));

  if (!isLinkedItem(item)) {
    return { ...item, kcal: nextKcal };
  }

  const nextQuantity = computeQuantityFromKcal(item, nextKcal);

  return {
    ...item,
    kcal: nextKcal,
    quantity: nextQuantity,
    kcalPer100g: item.kcalPer100g,
    quantitySource: 'derived',
  };
}

export function changeRowItemUnit(item: MealItemRowItem, unit: MealItemUnit): MealItemRowItem {
  if (unit === item.unit) {
    return item;
  }

  const totalGrams = getRowItemTotalGrams(item);

  if (unit === 'pcs') {
    if (!isPcsUnitAvailable(item)) {
      return item;
    }

    const nextItem: MealItemRowItem = {
      ...item,
      unit,
      quantity: MIN_QUANTITY_PCS,
    };

    if (!isLinkedItem(item)) {
      return nextItem;
    }

    return {
      ...nextItem,
      kcal: computeKcalFromQuantity(nextItem),
      kcalPer100g: item.kcalPer100g,
    };
  }

  const nextQuantity =
    item.unit === 'pcs'
      ? Math.max(MIN_QUANTITY_G, totalGrams)
      : Math.max(MIN_QUANTITY_G, item.quantity);

  const nextItem: MealItemRowItem = {
    ...item,
    unit,
    quantity: nextQuantity,
  };

  if (!isLinkedItem(item)) {
    return nextItem;
  }

  return {
    ...nextItem,
    kcal: computeKcalFromQuantity(nextItem),
    kcalPer100g: item.kcalPer100g,
  };
}

export function changeRowItemName(item: MealItemRowItem, name: string): MealItemRowItem {
  return { ...item, name };
}

export function isRowItemValid(item: MealItemRowItem): boolean {
  if (item.name.trim().length === 0) {
    return false;
  }

  if (!Number.isFinite(item.kcal) || item.kcal <= 0) {
    return false;
  }

  if (!Number.isFinite(item.quantity) || item.quantity < getMinQuantity(item.unit)) {
    return false;
  }

  if (item.unit === 'pcs') {
    if (isFreeCountRowItem(item)) {
      return true;
    }

    return isPcsUnitAvailable(item);
  }

  return getRowItemTotalGrams(item) > 0;
}

export function sumRowItemsKcal(items: MealItemRowItem[]): number {
  return items.reduce((total, item) => total + item.kcal, 0);
}

export function editableToRowItem(item: EditableMealItem): MealItemRowItem {
  const quantitySource = item.quantitySource;
  const kcalPer100g = item.kcalPer100g;

  if (item.quantityCount != null) {
    const linked =
      kcalPer100g != null && kcalPer100g > 0 && item.gramsPerUnit != null && item.gramsPerUnit > 0;
    const freeManualCount =
      item.origin === 'manual' && (kcalPer100g == null || kcalPer100g <= 0);

    if (linked || freeManualCount) {
      return {
        id: item.id,
        name: item.name,
        quantity: item.quantityCount,
        kcal: item.kcal,
        kcalPer100g,
        unit: 'pcs',
        origin: item.origin,
        quantitySource,
        gramsPerUnit: linked ? item.gramsPerUnit : null,
        foodId: item.foodId,
      };
    }
  }

  return {
    id: item.id,
    name: item.name,
    quantity: item.quantityGrams ?? DEFAULT_QUANTITY_G,
    kcal: item.kcal,
    kcalPer100g,
    unit: item.displayUnit === 'ml' ? 'ml' : 'g',
    origin: item.origin,
    gramsPerUnit: item.gramsPerUnit,
    foodId: item.foodId,
  };
}

export function rowItemToEditable(
  item: MealItemRowItem,
  origin: EditableMealItem['origin'] = 'manual',
): EditableMealItem {
  const name = item.name.trim();
  const totalGrams = getRowItemTotalGrams(item);
  const displayUnit = rowItemDisplayUnit(item);

  if (item.unit === 'pcs') {
    if (isFreeCountRowItem(item)) {
      return {
        id: item.id,
        name,
        canonicalName:
          origin === 'ai' ? name.toLowerCase().replace(/\s+/g, '_') : 'custom_ingredient',
        origin,
        quantityGrams: 0,
        quantityCount: item.quantity,
        gramsPerUnit: null,
        kcal: item.kcal,
        confidence: 'low',
        baselineGrams: 0,
        baselineCount: item.quantity,
        baselineGramsPerUnit: null,
        baselineKcal: item.kcal,
        foodId: item.foodId ?? null,
        kcalPer100g: item.kcalPer100g,
        quantitySource: item.quantitySource,
        displayUnit: 'g',
      };
    }

    if (isPcsUnitAvailable(item)) {
      return {
        id: item.id,
        name,
        canonicalName:
          origin === 'ai' ? name.toLowerCase().replace(/\s+/g, '_') : 'custom_ingredient',
        origin,
        quantityGrams: totalGrams,
        quantityCount: item.quantity,
        gramsPerUnit: item.gramsPerUnit,
        kcal: item.kcal,
        confidence: 'low',
        baselineGrams: totalGrams,
        baselineCount: item.quantity,
        baselineGramsPerUnit: item.gramsPerUnit,
        baselineKcal: item.kcal,
        foodId: item.foodId ?? null,
        kcalPer100g: item.kcalPer100g,
        quantitySource: item.quantitySource,
        displayUnit: 'g',
      };
    }
  }

  return {
    id: item.id,
    name,
    canonicalName: origin === 'ai' ? name.toLowerCase().replace(/\s+/g, '_') : 'custom_ingredient',
    origin,
    quantityGrams: item.quantity,
    quantityCount: null,
    gramsPerUnit: item.gramsPerUnit,
    kcal: item.kcal,
    confidence: 'low',
    baselineGrams: item.quantity,
    baselineCount: null,
    baselineGramsPerUnit: item.gramsPerUnit,
    baselineKcal: item.kcal,
    foodId: item.foodId ?? null,
    kcalPer100g: item.kcalPer100g,
    quantitySource: item.quantitySource,
    displayUnit,
  };
}

export function rowItemsToEditable(
  items: MealItemRowItem[],
  existingById?: Map<string, EditableMealItem>,
): EditableMealItem[] {
  return items.map((item) =>
    mergeRowIntoEditable(item, existingById?.get(item.id) ?? null),
  );
}

export function mergeRowIntoEditable(
  row: MealItemRowItem,
  existing: EditableMealItem | null,
): EditableMealItem {
  const origin = existing?.origin ?? 'manual';
  const base = existing ?? rowItemToEditable(row, origin);
  const totalGrams = getRowItemTotalGrams(row);
  const displayUnit = rowItemDisplayUnit(row);

  if (row.unit === 'pcs') {
    if (isFreeCountRowItem(row)) {
      return {
        ...base,
        name: row.name.trim(),
        quantityGrams: 0,
        quantityCount: row.quantity,
        gramsPerUnit: null,
        kcal: row.kcal,
        foodId: row.foodId ?? base.foodId,
        kcalPer100g: row.kcalPer100g,
        quantitySource: row.quantitySource,
        displayUnit: 'g',
      };
    }

    if (isPcsUnitAvailable(row)) {
      return {
        ...base,
        name: row.name.trim(),
        quantityGrams: totalGrams,
        quantityCount: row.quantity,
        gramsPerUnit: row.gramsPerUnit,
        kcal: row.kcal,
        foodId: row.foodId ?? base.foodId,
        kcalPer100g: row.kcalPer100g,
        quantitySource: row.quantitySource,
        displayUnit: 'g',
      };
    }

    if (origin === 'ai') {
      return {
        ...base,
        name: row.name.trim(),
        quantityGrams: base.quantityGrams,
        quantityCount: null,
        gramsPerUnit: null,
        kcal: row.kcal,
        foodId: row.foodId ?? base.foodId,
        kcalPer100g: row.kcalPer100g,
        quantitySource: row.quantitySource,
        displayUnit,
      };
    }
  }

  return {
    ...base,
    name: row.name.trim(),
    quantityGrams: row.quantity,
    quantityCount: null,
    gramsPerUnit: row.gramsPerUnit,
    kcal: row.kcal,
    foodId: row.foodId ?? base.foodId,
    kcalPer100g: row.kcalPer100g,
    quantitySource: row.quantitySource,
    displayUnit,
  };
}

export function rowItemToManualInput(
  item: MealItemRowItem,
): import('@/lib/meals').ManualMealEntryInput {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit === 'pcs' ? 'count' : item.unit === 'ml' ? 'ml' : 'grams',
    amount: item.quantity,
    gramsPerUnit: item.unit === 'pcs' ? item.gramsPerUnit : null,
    displayUnit: rowItemDisplayUnit(item),
    kcal: item.kcal,
    kcalPer100g: item.kcalPer100g,
    foodId: item.foodId ?? null,
  };
}

export function mealItemForEditToRow(item: import('@/lib/meals').MealItemForEdit): MealItemRowItem {
  const kcalPer100g =
    item.kcal_per_100g != null && item.kcal_per_100g > 0 ? item.kcal_per_100g : null;

  if (item.quantity_type === 'count' && item.count != null) {
    const hasPieceWeight =
      item.grams_per_unit != null && item.grams_per_unit > 0;
    const isFreeManualCount = !item.was_ai_generated && !hasPieceWeight;

    if (hasPieceWeight || isFreeManualCount) {
      return {
        id: createRowItemId(),
        mealItemId: item.id,
        wasAiGenerated: item.was_ai_generated,
        name: item.name,
        quantity: item.count,
        kcal: item.kcal,
        kcalPer100g,
        unit: 'pcs',
        origin: item.was_ai_generated ? 'ai' : 'manual',
        quantitySource: 'user',
        gramsPerUnit: hasPieceWeight ? item.grams_per_unit : null,
        foodId: null,
      };
    }
  }

  return {
    id: createRowItemId(),
    mealItemId: item.id,
    wasAiGenerated: item.was_ai_generated,
    name: item.name,
    quantity: item.quantity_grams,
    kcal: item.kcal,
    kcalPer100g,
    unit: item.display_unit === 'ml' ? 'ml' : 'g',
    origin: item.was_ai_generated ? 'ai' : 'manual',
    gramsPerUnit: null,
    foodId: null,
  };
}
