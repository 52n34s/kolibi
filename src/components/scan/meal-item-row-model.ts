import type { BarcodeProduct, FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';
import {
  absoluteMacrosFromPer100g,
  EMPTY_ABSOLUTE_MACROS,
  macrosPer100gFromAbsolutes,
  type AbsoluteMacros,
  type DisplayUnit,
  type EditableMealItem,
  type KcalPer100gSource,
  type MacrosPer100g,
  type QuantitySource,
} from '@/services/mealVision/types';

export type MealItemUnit = 'g' | 'ml' | 'pcs';

export type MealItemRowItem = {
  id: string;
  name: string;
  quantity: number;
  kcal: number;
  kcalPer100g: number | null;
  /** See EditableMealItem.kcalPer100gSource — drives kcal-edit coupling. */
  kcalPer100gSource: KcalPer100gSource | null;
  unit: MealItemUnit;
  origin: EditableMealItem['origin'];
  quantitySource: QuantitySource;
  /** Known piece weight in grams — required for pcs; never guessed. */
  gramsPerUnit: number | null;
  foodId?: string | null;
  mealItemId?: string | null;
  wasAiGenerated?: boolean;
  macrosPer100g: MacrosPer100g | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export const QUANTITY_STEP_G = 10;
export const QUANTITY_STEP_PCS = 1;
export const KCAL_STEP = 10;
/** Floor for g/ml when clamping user edits / unit switches (integers). Validity is any quantity > 0. */
export const MIN_QUANTITY_G = 1;
export const MIN_QUANTITY_PCS = 1;
export const MIN_KCAL = 0;
export const DEFAULT_QUANTITY_G = 100;

export type MealRowValidationIssue =
  | 'missingName'
  | 'invalidQuantity'
  | 'invalidKcal'
  | 'pcsUnavailable';

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

function rowAbsoluteMacros(item: MealItemRowItem): AbsoluteMacros {
  return {
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
  };
}

function withRecalculatedMacros(item: MealItemRowItem): MealItemRowItem {
  const next = absoluteMacrosFromPer100g(
    item.macrosPer100g,
    getRowItemTotalGrams(item),
    rowAbsoluteMacros(item),
  );

  return {
    ...item,
    proteinG: next.proteinG,
    carbsG: next.carbsG,
    fatG: next.fatG,
    fiberG: next.fiberG,
  };
}

function macrosFromPer100gFields(params: {
  proteinPer100g: number | null | undefined;
  carbsPer100g: number | null | undefined;
  fatPer100g: number | null | undefined;
  fiberPer100g?: number | null | undefined;
}): MacrosPer100g {
  const toField = (value: number | null | undefined): number | null =>
    value == null || !Number.isFinite(value) ? null : value;

  return {
    protein: toField(params.proteinPer100g),
    carbs: toField(params.carbsPer100g),
    fat: toField(params.fatPer100g),
    fiber: toField(params.fiberPer100g),
  };
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
    kcalPer100gSource: null,
    unit: 'g',
    origin: 'manual',
    quantitySource: 'user',
    gramsPerUnit: null,
    foodId: null,
    macrosPer100g: null,
    ...EMPTY_ABSOLUTE_MACROS,
  };
}

export function createRowItemFromBarcode(
  product: BarcodeProduct,
  quantityGrams: number,
  foodId: string | null = null,
): MealItemRowItem {
  const kcal = Math.max(
    0,
    Math.round((product.kcalPer100g / 100) * quantityGrams),
  );
  const macrosPer100g = macrosFromPer100gFields({
    proteinPer100g: product.proteinPer100g,
    carbsPer100g: product.carbsPer100g,
    fatPer100g: product.fatPer100g,
    fiberPer100g: product.fiberPer100g,
  });
  const absoluteMacros = absoluteMacrosFromPer100g(
    macrosPer100g,
    quantityGrams,
    EMPTY_ABSOLUTE_MACROS,
  );

  return {
    id: createRowItemId(),
    name: product.productName,
    quantity: quantityGrams,
    kcal,
    kcalPer100g: product.kcalPer100g,
    kcalPer100gSource: 'database',
    unit: 'g',
    origin: 'manual',
    quantitySource: 'user',
    gramsPerUnit: product.servingSizeGrams,
    foodId,
    macrosPer100g,
    ...absoluteMacros,
  };
}

export function createRowItemFromFoodSearch(params: {
  product: FoodSearchProduct;
  foodId: string | null;
  quantityGrams?: number;
}): MealItemRowItem {
  const quantityGrams = params.quantityGrams ?? DEFAULT_QUANTITY_G;
  const kcal = Math.max(
    0,
    Math.round((params.product.kcalPer100g / 100) * quantityGrams),
  );
  const macrosPer100g = macrosFromPer100gFields({
    proteinPer100g: params.product.proteinPer100g,
    carbsPer100g: params.product.carbsPer100g,
    fatPer100g: params.product.fatPer100g,
    fiberPer100g: params.product.fiberPer100g,
  });
  const absoluteMacros = absoluteMacrosFromPer100g(
    macrosPer100g,
    quantityGrams,
    EMPTY_ABSOLUTE_MACROS,
  );

  return {
    id: createRowItemId(),
    name: params.product.name,
    quantity: quantityGrams,
    kcal,
    kcalPer100g: params.product.kcalPer100g,
    kcalPer100gSource: 'database',
    unit: 'g',
    origin: 'manual',
    quantitySource: 'user',
    gramsPerUnit: params.product.servingSizeGrams,
    foodId: params.foodId,
    macrosPer100g,
    ...absoluteMacros,
  };
}

export function applyOffProductToRow(
  item: MealItemRowItem,
  product: FoodSearchProduct,
  foodId: string | null,
): MealItemRowItem {
  const fromSearch = createRowItemFromFoodSearch({
    product,
    foodId,
    quantityGrams: item.quantity,
  });

  return {
    ...fromSearch,
    id: item.id,
    unit: item.unit,
    quantity: item.quantity,
    quantitySource: item.quantitySource,
    mealItemId: item.mealItemId,
    wasAiGenerated: item.wasAiGenerated,
  };
}

export function createManualRowItemFromQuery(name: string): MealItemRowItem {
  return {
    ...createEmptyRowItem(),
    name: name.trim(),
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
    return withRecalculatedMacros(nextItem);
  }

  return withRecalculatedMacros({
    ...nextItem,
    kcal: computeKcalFromQuantity(nextItem),
    kcalPer100g: item.kcalPer100g,
  });
}

export function changeRowItemKcal(item: MealItemRowItem, kcal: number): MealItemRowItem {
  const nextKcal = Math.max(MIN_KCAL, Math.round(kcal));

  if (!isLinkedItem(item)) {
    return { ...item, kcal: nextKcal };
  }

  // Derived density: user kcal edit updates the reference; quantity stays put.
  if (item.kcalPer100gSource === 'derived') {
    const menge = getLinkedMenge(item);
    const nextKcalPer100g =
      menge > 0 ? Math.max(0, (nextKcal / menge) * 100) : item.kcalPer100g;

    return {
      ...item,
      kcal: nextKcal,
      kcalPer100g: nextKcalPer100g,
      kcalPer100gSource: 'derived',
    };
  }

  // Database density: kcal edits rescale quantity; kcalPer100g never changes.
  const nextQuantity = computeQuantityFromKcal(item, nextKcal);

  return {
    ...item,
    kcal: nextKcal,
    quantity: nextQuantity,
    kcalPer100g: item.kcalPer100g,
    kcalPer100gSource: item.kcalPer100gSource ?? 'database',
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
      return withRecalculatedMacros(nextItem);
    }

    return withRecalculatedMacros({
      ...nextItem,
      kcal: computeKcalFromQuantity(nextItem),
      kcalPer100g: item.kcalPer100g,
    });
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
    return withRecalculatedMacros(nextItem);
  }

  return withRecalculatedMacros({
    ...nextItem,
    kcal: computeKcalFromQuantity(nextItem),
    kcalPer100g: item.kcalPer100g,
  });
}

export function changeRowItemName(item: MealItemRowItem, name: string): MealItemRowItem {
  return { ...item, name };
}

export function getRowItemValidationIssue(item: MealItemRowItem): MealRowValidationIssue | null {
  if (item.name.trim().length === 0) {
    return 'missingName';
  }

  if (!Number.isFinite(item.kcal) || item.kcal < 0) {
    return 'invalidKcal';
  }

  if (item.unit === 'pcs') {
    if (!Number.isFinite(item.quantity) || item.quantity < MIN_QUANTITY_PCS) {
      return 'invalidQuantity';
    }

    if (!isFreeCountRowItem(item) && !isPcsUnitAvailable(item)) {
      return 'pcsUnavailable';
    }

    return null;
  }

  // g/ml: any positive amount is valid (incl. photo-scan values under the old 10g floor).
  if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !(getRowItemTotalGrams(item) > 0)) {
    return 'invalidQuantity';
  }

  return null;
}

export function isRowItemValid(item: MealItemRowItem): boolean {
  return getRowItemValidationIssue(item) == null;
}

/** First blocking reason across rows, or null when every row is valid. */
export function getMealItemsValidationIssue(
  items: MealItemRowItem[],
): MealRowValidationIssue | 'empty' | null {
  if (items.length === 0) {
    return 'empty';
  }

  for (const item of items) {
    const issue = getRowItemValidationIssue(item);
    if (issue != null) {
      return issue;
    }
  }

  return null;
}

export function mealValidationIssueToManualEntryKey(
  issue: MealRowValidationIssue | 'empty',
): string {
  switch (issue) {
    case 'empty':
      return 'home.manualEntry.validationNoProducts';
    case 'missingName':
      return 'home.manualEntry.validationMissingName';
    case 'invalidQuantity':
      return 'home.manualEntry.validationQuantityMustBePositive';
    case 'invalidKcal':
      return 'home.manualEntry.validationKcalMustBePositive';
    case 'pcsUnavailable':
      return 'home.manualEntry.validationPcsUnavailable';
  }
}

export function mealValidationIssueToConfirmationKey(
  issue: MealRowValidationIssue | 'empty',
): string {
  switch (issue) {
    case 'empty':
      return 'home.scan.confirmation.validationNoIngredients';
    case 'missingName':
      return 'home.scan.confirmation.validationMissingName';
    case 'invalidQuantity':
      return 'home.scan.confirmation.validationQuantityMustBePositive';
    case 'invalidKcal':
      return 'home.scan.confirmation.validationKcalMustBePositive';
    case 'pcsUnavailable':
      return 'home.scan.confirmation.validationPcsUnavailable';
  }
}

export function sumRowItemsKcal(items: MealItemRowItem[]): number {
  return items.reduce((total, item) => total + item.kcal, 0);
}

export function editableToRowItem(item: EditableMealItem): MealItemRowItem {
  const quantitySource = item.quantitySource;
  const kcalPer100g = item.kcalPer100g;
  const kcalPer100gSource = item.kcalPer100gSource;
  const macroFields = {
    macrosPer100g: item.macrosPer100g,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
  };

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
        kcalPer100gSource,
        unit: 'pcs',
        origin: item.origin,
        quantitySource,
        gramsPerUnit: linked ? item.gramsPerUnit : null,
        foodId: item.foodId,
        ...macroFields,
      };
    }
  }

  return {
    id: item.id,
    name: item.name,
    quantity: item.quantityGrams ?? DEFAULT_QUANTITY_G,
    kcal: item.kcal,
    kcalPer100g,
    kcalPer100gSource,
    unit: item.displayUnit === 'ml' ? 'ml' : 'g',
    origin: item.origin,
    quantitySource,
    gramsPerUnit: item.gramsPerUnit,
    foodId: item.foodId,
    ...macroFields,
  };
}

export function rowItemToEditable(
  item: MealItemRowItem,
  origin: EditableMealItem['origin'] = 'manual',
): EditableMealItem {
  const name = item.name.trim();
  const totalGrams = getRowItemTotalGrams(item);
  const displayUnit = rowItemDisplayUnit(item);
  const macroFields = {
    macrosPer100g: item.macrosPer100g,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
  };

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
        kcalPer100gSource: item.kcalPer100gSource ?? null,
        quantitySource: item.quantitySource,
        displayUnit: 'g',
        ...macroFields,
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
        kcalPer100gSource: item.kcalPer100gSource ?? null,
        quantitySource: item.quantitySource,
        displayUnit: 'g',
        ...macroFields,
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
    kcalPer100gSource: item.kcalPer100gSource ?? null,
    quantitySource: item.quantitySource,
    displayUnit,
    ...macroFields,
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
  const macroFields = {
    macrosPer100g: row.macrosPer100g,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
  };

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
        kcalPer100gSource: row.kcalPer100gSource ?? base.kcalPer100gSource ?? null,
        quantitySource: row.quantitySource,
        displayUnit: 'g',
        ...macroFields,
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
        kcalPer100gSource: row.kcalPer100gSource ?? base.kcalPer100gSource ?? null,
        quantitySource: row.quantitySource,
        displayUnit: 'g',
        ...macroFields,
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
        kcalPer100gSource: row.kcalPer100gSource ?? base.kcalPer100gSource ?? null,
        quantitySource: row.quantitySource,
        displayUnit,
        ...macroFields,
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
    kcalPer100gSource: row.kcalPer100gSource ?? base.kcalPer100gSource ?? null,
    quantitySource: row.quantitySource,
    displayUnit,
    ...macroFields,
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
    macrosPer100g: item.macrosPer100g,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
  };
}

export function mealItemForEditToRow(item: import('@/lib/meals').MealItemForEdit): MealItemRowItem {
  const kcalPer100g =
    item.kcal_per_100g != null && item.kcal_per_100g > 0 ? item.kcal_per_100g : null;
  // Persisted meal_items density is treated as database until we store source explicitly.
  const kcalPer100gSource = kcalPer100g != null ? ('database' as const) : null;
  const proteinG = item.protein_g;
  const carbsG = item.carbs_g;
  const fatG = item.fat_g;
  const fiberG = item.fiber_g;

  if (item.quantity_type === 'count' && item.count != null) {
    const hasPieceWeight =
      item.grams_per_unit != null && item.grams_per_unit > 0;
    const isFreeManualCount = !item.was_ai_generated && !hasPieceWeight;
    const totalGrams = hasPieceWeight
      ? item.count * (item.grams_per_unit ?? 0)
      : item.quantity_grams;
    const macrosPer100g = macrosPer100gFromAbsolutes(
      { protein: proteinG, carbs: carbsG, fat: fatG, fiber: fiberG },
      totalGrams,
    );

    if (hasPieceWeight || isFreeManualCount) {
      return {
        id: createRowItemId(),
        mealItemId: item.id,
        wasAiGenerated: item.was_ai_generated,
        name: item.name,
        quantity: item.count,
        kcal: item.kcal,
        kcalPer100g,
        kcalPer100gSource,
        unit: 'pcs',
        origin: item.was_ai_generated ? 'ai' : 'manual',
        quantitySource: 'user',
        gramsPerUnit: hasPieceWeight ? item.grams_per_unit : null,
        foodId: null,
        macrosPer100g,
        proteinG,
        carbsG,
        fatG,
        fiberG,
      };
    }
  }

  const macrosPer100g = macrosPer100gFromAbsolutes(
    { protein: proteinG, carbs: carbsG, fat: fatG, fiber: fiberG },
    item.quantity_grams,
  );

  return {
    id: createRowItemId(),
    mealItemId: item.id,
    wasAiGenerated: item.was_ai_generated,
    name: item.name,
    quantity: item.quantity_grams,
    kcal: item.kcal,
    kcalPer100g,
    kcalPer100gSource,
    unit: item.display_unit === 'ml' ? 'ml' : 'g',
    origin: item.was_ai_generated ? 'ai' : 'manual',
    quantitySource: 'user',
    gramsPerUnit: null,
    foodId: null,
    macrosPer100g,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  };
}
