import { z } from 'zod';

import {
  getDefaultOption,
  getQuantityGramsForOption,
  type QuantityPresetSource,
} from '@/components/scan/barcode-quantity-utils';

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
    fiber_g: boundedMacroSchema,
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

/** Nutrition table transcribed off packaging — mirrors the edge function's label schema. */
export const visionLabelBasisSchema = z.enum(['per_100g', 'per_100ml']);

const labelPer100Schema = z.number().min(0).max(1000).nullable().default(null);
const labelWeightSchema = z.number().min(0).max(100_000).nullable().default(null);

export const visionLabelSchema = z.object({
  name: z.string().min(1),
  canonical_name: z.string().min(1),
  basis: visionLabelBasisSchema,
  kcal_per_100: z.number().min(0).max(2000),
  protein_per_100: labelPer100Schema,
  carbs_per_100: labelPer100Schema,
  fat_per_100: labelPer100Schema,
  fiber_per_100: labelPer100Schema,
  sugar_per_100: labelPer100Schema,
  package_grams: labelWeightSchema,
  serving_grams: labelWeightSchema,
  confidence: visionConfidenceSchema,
});

/** Server-side Atwater cross-check; display only, never persisted. */
export const labelPlausibilitySchema = z.object({
  checked: z.boolean(),
  expected_kcal_eu: z.number().nullable(),
  expected_kcal_us: z.number().nullable(),
  passed: z.boolean().nullable(),
});

export const visionLabelResponseSchema = z.object({
  image_type: z.literal('label'),
  label: visionLabelSchema,
  plausibility: labelPlausibilitySchema.nullable().default(null),
});

export type VisionLabelBasis = z.infer<typeof visionLabelBasisSchema>;
export type VisionLabel = z.infer<typeof visionLabelSchema>;
export type LabelPlausibility = z.infer<typeof labelPlausibilitySchema>;
export type VisionLabelResponse = z.infer<typeof visionLabelResponseSchema>;

export type VisionConfidence = z.infer<typeof visionConfidenceSchema>;
export type VisionFoodItem = z.infer<typeof visionFoodItemSchema>;
export type VisionResponse = z.infer<typeof visionResponseSchema>;

export type QuantitySource = 'user' | 'derived' | 'ai';

export type DisplayUnit = 'g' | 'ml';

/**
 * Origin of kcalPer100g: verified foods row, derived from model kcal/grams, or
 * transcribed off a nutrition label. 'label' couples like 'database' but never
 * feeds portion calibration — the density is read, not estimated.
 */
export type KcalPer100gSource = 'database' | 'derived' | 'label';

/** Macro density per 100 g. null on a field = unknown (never coerced to 0). */
export type MacrosPer100g = {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
};

export type AbsoluteMacros = {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export function effectiveGramsFromVisionItem(item: {
  estimated_grams: number | null;
  estimated_count: number | null;
  estimated_grams_per_unit: number | null;
}): number | null {
  if (item.estimated_grams != null && item.estimated_grams > 0) {
    return item.estimated_grams;
  }

  if (
    item.estimated_count != null &&
    item.estimated_grams_per_unit != null &&
    item.estimated_grams_per_unit > 0
  ) {
    const total = item.estimated_count * item.estimated_grams_per_unit;
    return total > 0 ? total : null;
  }

  return null;
}

function optionalMacro(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : value;
}

/** Normalize portion absolute → per 100 g. null in stays null; requires grams > 0. */
export function macrosPer100gFromAbsolutes(
  absolutes: {
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    fiber?: number | null;
  },
  grams: number,
): MacrosPer100g | null {
  if (!(grams > 0)) {
    return null;
  }

  const scale = (value: number | null | undefined): number | null => {
    const normalized = optionalMacro(value);
    return normalized == null ? null : (normalized / grams) * 100;
  };

  return {
    protein: scale(absolutes.protein),
    carbs: scale(absolutes.carbs),
    fat: scale(absolutes.fat),
    fiber: scale(absolutes.fiber),
  };
}

/**
 * Portion absolutes from density × grams / 100.
 * When macrosPer100g is null, previous absolutes are left unchanged.
 * A null density field yields a null absolute (never 0).
 */
export function absoluteMacrosFromPer100g(
  macrosPer100g: MacrosPer100g | null,
  grams: number,
  previous: AbsoluteMacros,
): AbsoluteMacros {
  if (macrosPer100g == null || !(grams > 0)) {
    return previous;
  }

  const scale = (value: number | null): number | null =>
    value == null ? null : (value / 100) * grams;

  return {
    proteinG: scale(macrosPer100g.protein),
    carbsG: scale(macrosPer100g.carbs),
    fatG: scale(macrosPer100g.fat),
    fiberG: scale(macrosPer100g.fiber),
  };
}

export const EMPTY_ABSOLUTE_MACROS: AbsoluteMacros = {
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
};

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
  /**
   * 'database' = foods/OFF density (kcal edits adjust quantity).
   * 'derived' = inferred from model (kcal edits update density).
   * null when unlinked.
   */
  kcalPer100gSource: KcalPer100gSource | null;
  quantitySource: QuantitySource;
  /** Label only — ml is stored as quantity_type grams with 1:1 density. */
  displayUnit: DisplayUnit;
  /** Density for coupling quantity ↔ macros. null = macros stay as-is on quantity edits. */
  macrosPer100g: MacrosPer100g | null;
  /** Absolute grams for the current portion (not per 100 g). null = unknown. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
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

  const proteinG = optionalMacro(item.protein_g);
  const carbsG = optionalMacro(item.carbs_g);
  const fatG = optionalMacro(item.fat_g);
  const fiberG = optionalMacro(item.fiber_g);
  const effectiveGrams = effectiveGramsFromVisionItem(item);
  const macrosPer100g =
    effectiveGrams != null
      ? macrosPer100gFromAbsolutes(
          { protein: proteinG, carbs: carbsG, fat: fatG, fiber: fiberG },
          effectiveGrams,
        )
      : null;

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
    kcalPer100gSource: null,
    quantitySource: 'ai',
    displayUnit: 'g',
    macrosPer100g,
    proteinG,
    carbsG,
    fatG,
    fiberG,
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
    kcalPer100gSource: null,
    quantitySource: 'user',
    displayUnit: 'g',
    macrosPer100g: null,
    ...EMPTY_ABSOLUTE_MACROS,
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

/** Package/serving sizes a label printed, in the shape the quantity presets take. */
export function labelQuantityPresetSource(label: VisionLabel): QuantityPresetSource {
  return {
    quantityGrams: label.package_grams,
    servingSizeGrams: label.serving_grams,
  };
}

/**
 * One editable item from a transcribed nutrition label.
 * The start amount follows the barcode flow's default (package, then serving);
 * when the label printed neither, the amount stays empty and the sheet's own
 * validation turns it into a required field.
 */
export function labelToEditableItem(label: VisionLabel, id: string): EditableMealItem {
  const presetSource = labelQuantityPresetSource(label);
  const option = getDefaultOption(presetSource);
  const quantityGrams =
    option === 'custom' ? 0 : getQuantityGramsForOption(option, presetSource, 0);

  const macrosPer100g: MacrosPer100g = {
    protein: optionalMacro(label.protein_per_100),
    carbs: optionalMacro(label.carbs_per_100),
    fat: optionalMacro(label.fat_per_100),
    fiber: optionalMacro(label.fiber_per_100),
  };
  const kcalPer100g = label.kcal_per_100 > 0 ? label.kcal_per_100 : null;
  const kcal =
    kcalPer100g != null ? Math.max(0, Math.round((kcalPer100g / 100) * quantityGrams)) : 0;
  const absoluteMacros = absoluteMacrosFromPer100g(
    macrosPer100g,
    quantityGrams,
    EMPTY_ABSOLUTE_MACROS,
  );

  return {
    id,
    name: label.name,
    canonicalName: label.canonical_name,
    origin: 'ai',
    quantityGrams,
    quantityCount: null,
    gramsPerUnit: null,
    kcal,
    confidence: label.confidence,
    baselineGrams: quantityGrams,
    baselineCount: null,
    baselineGramsPerUnit: null,
    baselineKcal: kcal,
    foodId: null,
    kcalPer100g,
    kcalPer100gSource: 'label',
    quantitySource: 'ai',
    displayUnit: label.basis === 'per_100ml' ? 'ml' : 'g',
    macrosPer100g,
    ...absoluteMacros,
  };
}
