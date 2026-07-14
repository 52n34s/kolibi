import { z } from 'zod';

export const visionConfidenceSchema = z.enum(['low', 'medium', 'high']);

const boundedMacroSchema = z.number().min(0).max(1000).optional();

export const visionFoodItemSchema = z
  .object({
    name: z.string().min(1),
    canonical_name: z.string().min(1),
    estimated_grams: z.number().min(0).max(5000).nullable(),
    estimated_count: z.number().positive().max(5000).nullable(),
    estimated_grams_per_unit: z.number().min(0).max(5000).nullable(),
    estimated_kcal: z.number().min(0).max(5000),
    protein_g: boundedMacroSchema,
    carbs_g: boundedMacroSchema,
    fat_g: boundedMacroSchema,
    confidence: visionConfidenceSchema,
  })
  .superRefine((item, ctx) => {
    const hasCount = item.estimated_count != null;
    const hasGrams = item.estimated_grams != null;

    if (hasCount && hasGrams) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either estimated_grams or estimated_count, not both.',
      });
    }

    if (!hasCount && !hasGrams) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either estimated_grams or estimated_count must be provided.',
      });
    }

    if (hasCount && item.estimated_grams_per_unit == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'estimated_grams_per_unit is required when estimated_count is set.',
      });
    }

    if (!hasCount && item.estimated_grams_per_unit != null) {
      ctx.addIssue({
        code: 'custom',
        message: 'estimated_grams_per_unit must be null when estimated_count is not set.',
      });
    }

    if (hasCount && item.estimated_grams_per_unit != null) {
      const totalGrams = item.estimated_count! * item.estimated_grams_per_unit;
      if (totalGrams > 5000) {
        ctx.addIssue({
          code: 'custom',
          message: 'Derived quantity_grams exceeds 5000.',
        });
      }
    }
  });

export const visionResponseSchema = z.object({
  items: z.array(visionFoodItemSchema).min(1).max(30),
});

export type VisionConfidence = z.infer<typeof visionConfidenceSchema>;
export type VisionFoodItem = z.infer<typeof visionFoodItemSchema>;
export type VisionResponse = z.infer<typeof visionResponseSchema>;

export type QuantitySource = 'user' | 'derived' | 'ai';

export type DisplayUnit = 'g' | 'ml';

export type EditableMealItem = {
  id: string;
  name: string;
  canonicalName: string;
  origin: 'ai' | 'manual';
  quantityGrams: number | null;
  quantityCount: number | null;
  gramsPerUnit: number | null;
  kcal: number;
  confidence: VisionConfidence;
  baselineGrams: number | null;
  baselineCount: number | null;
  baselineGramsPerUnit: number | null;
  baselineKcal: number;
  foodId: string | null;
  kcalPer100g: number | null;
  quantitySource: QuantitySource;
  /** Label only — ml is stored as quantity_type grams with 1:1 density. */
  displayUnit: DisplayUnit;
};

export function getItemTotalGrams(item: EditableMealItem): number {
  if (
    item.quantityCount != null &&
    item.gramsPerUnit != null &&
    item.gramsPerUnit > 0
  ) {
    return item.quantityCount * item.gramsPerUnit;
  }

  return item.quantityGrams ?? 0;
}

export function getBaselineTotalGrams(item: EditableMealItem): number {
  if (
    item.baselineCount != null &&
    item.baselineGramsPerUnit != null &&
    item.baselineGramsPerUnit > 0
  ) {
    return item.baselineCount * item.baselineGramsPerUnit;
  }

  return item.baselineGrams ?? 0;
}

export function visionItemToEditable(item: VisionFoodItem, id: string): EditableMealItem {
  const quantityCount = item.estimated_count;
  const gramsPerUnit = item.estimated_grams_per_unit;
  const hasCountPieceWeight =
    quantityCount != null && gramsPerUnit != null && gramsPerUnit > 0;
  const isCountItem = hasCountPieceWeight;
  const quantityGrams = isCountItem ? quantityCount * gramsPerUnit : item.estimated_grams;

  const baselineCount = hasCountPieceWeight ? quantityCount : null;
  const baselineGramsPerUnit = hasCountPieceWeight ? gramsPerUnit : null;
  const baselineGrams = isCountItem ? quantityCount * gramsPerUnit : item.estimated_grams;

  return {
    id,
    name: item.name,
    canonicalName: item.canonical_name,
    origin: 'ai',
    quantityGrams,
    quantityCount: hasCountPieceWeight ? quantityCount : null,
    gramsPerUnit: hasCountPieceWeight ? gramsPerUnit : null,
    kcal: Math.round(item.estimated_kcal),
    confidence: item.confidence,
    baselineGrams,
    baselineCount,
    baselineGramsPerUnit,
    baselineKcal: item.estimated_kcal,
    foodId: null,
    kcalPer100g: null,
    quantitySource: 'ai',
    displayUnit: 'g',
  };
}

export function createManualEditableItem(params: {
  id: string;
  name?: string;
  canonicalName?: string;
  quantityGrams?: number;
  kcal?: number;
}): EditableMealItem {
  const quantityGrams = params.quantityGrams ?? 100;
  const baselineKcal = params.kcal ?? 100;

  return {
    id: params.id,
    name: params.name ?? '',
    canonicalName: params.canonicalName ?? 'custom_ingredient',
    origin: 'manual',
    quantityGrams,
    quantityCount: null,
    gramsPerUnit: null,
    kcal: baselineKcal,
    confidence: 'low',
    baselineGrams: quantityGrams,
    baselineCount: null,
    baselineGramsPerUnit: null,
    baselineKcal,
    foodId: null,
    kcalPer100g: null,
    quantitySource: 'user',
    displayUnit: 'g',
  };
}

export function scaleItemKcal(item: EditableMealItem, nextQuantity: number): number {
  const baselineTotalGrams = getBaselineTotalGrams(item);
  if (baselineTotalGrams <= 0 || item.baselineKcal <= 0) {
    return item.kcal;
  }

  const nextTotalGrams =
    item.quantityCount != null && item.gramsPerUnit != null
      ? nextQuantity * item.gramsPerUnit
      : nextQuantity;

  return Math.max(0, Math.round((nextTotalGrams / baselineTotalGrams) * item.baselineKcal));
}

export function sumEditableKcal(items: EditableMealItem[]): number {
  return items.reduce((total, item) => total + item.kcal, 0);
}

export function wasMealItemEdited(item: EditableMealItem): boolean {
  if (item.quantityCount != null) {
    return (
      item.quantityCount !== item.baselineCount ||
      item.gramsPerUnit !== item.baselineGramsPerUnit
    );
  }

  return item.quantityGrams !== item.baselineGrams;
}

/** True only when the user directly changed quantity (not via kcal-derived recalc). */
export function wasQuantityUserCorrected(item: EditableMealItem): boolean {
  if (item.quantitySource === 'derived') {
    return false;
  }

  return wasMealItemEdited(item);
}
