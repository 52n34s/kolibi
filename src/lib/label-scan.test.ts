import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAvailableQuantityOptions,
  getDefaultCustomGrams,
  getDefaultOption,
  getQuantityGramsForOption,
  type QuantityPresetSource,
} from '../components/scan/barcode-quantity-utils.ts';
import {
  changeRowItemKcal,
  editableToRowItem,
  type MealItemRowItem,
} from '../components/scan/meal-item-row-model.ts';
import {
  labelQuantityPresetSource,
  labelToEditableItem,
  type EditableMealItem,
  type VisionLabel,
} from '../services/mealVision/types.ts';
import { buildFoodAdjustmentRow } from './food-adjustments.ts';

function makeLabel(overrides: Partial<VisionLabel> = {}): VisionLabel {
  return {
    name: 'Haferflocken',
    canonical_name: 'rolled_oats',
    basis: 'per_100g',
    kcal_per_100: 372,
    protein_per_100: 13.5,
    carbs_per_100: 58.7,
    fat_per_100: 7,
    fiber_per_100: 10,
    sugar_per_100: 1.1,
    package_grams: 500,
    serving_grams: 40,
    confidence: 'high',
    ...overrides,
  };
}

describe('labelToEditableItem', () => {
  it('carries the printed density over and starts at the serving size', () => {
    const item = labelToEditableItem(makeLabel(), 'row-1');

    assert.equal(item.id, 'row-1');
    assert.equal(item.name, 'Haferflocken');
    assert.equal(item.canonicalName, 'rolled_oats');
    assert.equal(item.origin, 'ai');
    assert.equal(item.foodId, null);
    assert.equal(item.kcalPer100g, 372);
    assert.equal(item.kcalPer100gSource, 'label');
    assert.equal(item.displayUnit, 'g');
    assert.equal(item.quantityGrams, 40);
    assert.equal(item.quantityCount, null);
    // 372 kcal/100 g × 40 g
    assert.equal(item.kcal, 149);
    assert.equal(item.baselineGrams, 40);
    assert.equal(item.baselineKcal, 149);
    assert.equal(item.quantitySource, 'ai');
    assert.equal(item.confidence, 'high');
  });

  it('mirrors the label macros as a per-100 density and scales the portion', () => {
    const item = labelToEditableItem(makeLabel(), 'row-1');

    assert.deepEqual(item.macrosPer100g, {
      protein: 13.5,
      carbs: 58.7,
      fat: 7,
      fiber: 10,
    });
    assert.equal(item.proteinG, 5.4);
    assert.equal(item.fiberG, 4);
  });

  it('keeps unreadable macros null instead of coercing them to 0', () => {
    const item = labelToEditableItem(
      makeLabel({ protein_per_100: null, fiber_per_100: null }),
      'row-1',
    );

    assert.deepEqual(item.macrosPer100g, {
      protein: null,
      carbs: 58.7,
      fat: 7,
      fiber: null,
    });
    assert.equal(item.proteinG, null);
    assert.equal(item.fiberG, null);
    // A printed zero stays a zero.
    const zeroFat = labelToEditableItem(makeLabel({ fat_per_100: 0 }), 'row-2');
    assert.equal(zeroFat.macrosPer100g?.fat, 0);
    assert.equal(zeroFat.fatG, 0);
  });

  it('uses ml as the display unit for a per_100ml label', () => {
    const item = labelToEditableItem(
      makeLabel({ basis: 'per_100ml', package_grams: 1000, serving_grams: 200 }),
      'row-1',
    );

    assert.equal(item.displayUnit, 'ml');
    assert.equal(item.quantityGrams, 200);
  });

  it('falls back to the package size when no serving was printed', () => {
    const item = labelToEditableItem(makeLabel({ serving_grams: null }), 'row-1');

    assert.equal(item.quantityGrams, 500);
    assert.equal(item.kcal, 1860);
  });

  it('falls back to the serving size when no package size was printed', () => {
    const item = labelToEditableItem(makeLabel({ package_grams: null }), 'row-1');

    assert.equal(item.quantityGrams, 40);
    assert.equal(item.kcal, 149);
  });

  it('leaves the amount empty when the label printed neither size', () => {
    const item = labelToEditableItem(
      makeLabel({ package_grams: null, serving_grams: null }),
      'row-1',
    );

    assert.equal(item.quantityGrams, 0);
    assert.equal(item.kcal, 0);
    assert.equal(item.proteinG, null, 'no portion means no absolute macros yet');
    // The density survives so the row still recomputes once an amount is typed.
    assert.equal(item.kcalPer100g, 372);

    // An empty amount must block saving — this is what makes it a required field.
    const row = editableToRowItem(item);
    assert.equal(row.quantity, 0);
  });

  it('exposes the printed sizes as a quantity preset source', () => {
    assert.deepEqual(labelQuantityPresetSource(makeLabel()), {
      quantityGrams: 500,
      servingSizeGrams: 40,
    });
  });
});

describe('changeRowItemKcal source coupling', () => {
  function rowFrom(source: MealItemRowItem['kcalPer100gSource']): MealItemRowItem {
    return {
      // Package only — keeps the historic 100 g start so kcal↔density math stays stable.
      ...editableToRowItem(
        labelToEditableItem(makeLabel({ package_grams: 100, serving_grams: null }), 'row-1'),
      ),
      kcalPer100gSource: source,
    };
  }

  it('treats a label density exactly like a database density', () => {
    const label = changeRowItemKcal(rowFrom('label'), 186);
    const database = changeRowItemKcal(rowFrom('database'), 186);

    assert.equal(label.kcalPer100g, 372, 'a transcribed density is never rewritten');
    assert.equal(label.quantity, 50, 'the amount moves instead');
    assert.equal(label.kcalPer100gSource, 'label');
    assert.equal(label.quantitySource, 'derived');

    assert.equal(database.kcalPer100g, label.kcalPer100g);
    assert.equal(database.quantity, label.quantity);
    assert.equal(database.quantitySource, label.quantitySource);
  });

  it('rewrites the density instead of the amount for a derived source', () => {
    const derived = changeRowItemKcal(rowFrom('derived'), 186);

    assert.equal(derived.quantity, 100, 'the amount stays put');
    assert.equal(derived.kcalPer100g, 186);
    assert.equal(derived.kcalPer100gSource, 'derived');
  });

  it('rescales the amount for an unlabelled source', () => {
    const unset = changeRowItemKcal(rowFrom(null), 186);

    assert.equal(unset.kcalPer100g, 372);
    assert.equal(unset.quantity, 50);
    assert.equal(unset.kcalPer100gSource, 'database');
  });

  it('leaves the density of an unlinked row alone', () => {
    const unlinked = changeRowItemKcal(
      { ...rowFrom('label'), kcalPer100g: null, kcalPer100gSource: null },
      186,
    );

    assert.equal(unlinked.kcal, 186);
    assert.equal(unlinked.kcalPer100g, null);
    assert.equal(unlinked.quantity, 100, 'nothing to rescale against');
  });
});

describe('buildFoodAdjustmentRow', () => {
  const insertedItem = { id: 'meal-item-1', sort_order: 0 };
  const params = { userId: 'user-1', includeInCalibration: true };

  function correctedItem(overrides: Partial<EditableMealItem> = {}): EditableMealItem {
    return {
      // Package-only start so baseline stays 500 g (AI estimate vs user correction).
      ...labelToEditableItem(makeLabel({ serving_grams: null }), 'row-1'),
      // The user corrected 500 g down to 400 g.
      quantityGrams: 400,
      quantitySource: 'user',
      ...overrides,
    };
  }

  it('skips label-sourced items even when the amount was corrected', () => {
    assert.equal(buildFoodAdjustmentRow(correctedItem(), insertedItem, params), null);
  });

  it('still records a corrected AI estimate from a photo scan', () => {
    const row = buildFoodAdjustmentRow(
      correctedItem({ kcalPer100gSource: 'database' }),
      insertedItem,
      params,
    );

    assert.notEqual(row, null);
    assert.equal(row?.food_name_normalized, 'rolled_oats');
    assert.equal(row?.ai_estimated_grams, 500);
    assert.equal(row?.corrected_grams, 400);
    assert.equal(row?.include_in_calibration, true);
  });

  it('skips an untouched AI estimate', () => {
    const row = buildFoodAdjustmentRow(
      correctedItem({ kcalPer100gSource: 'database', quantityGrams: 500 }),
      insertedItem,
      params,
    );

    assert.equal(row, null);
  });

  it('skips manual items', () => {
    const row = buildFoodAdjustmentRow(
      correctedItem({ kcalPer100gSource: 'database', origin: 'manual' }),
      insertedItem,
      params,
    );

    assert.equal(row, null);
  });
});

describe('quantity presets accept any structural source', () => {
  const label: QuantityPresetSource = { quantityGrams: 500, servingSizeGrams: 40 };
  const servingOnly: QuantityPresetSource = { quantityGrams: null, servingSizeGrams: 40 };
  const nothing: QuantityPresetSource = { quantityGrams: null, servingSizeGrams: null };
  const multipack: QuantityPresetSource = { quantityGrams: 250, servingSizeGrams: 25 };
  const nonsenseServing: QuantityPresetSource = { quantityGrams: 100, servingSizeGrams: 250 };

  it('offers package options only when a package size is known', () => {
    assert.deepEqual(getAvailableQuantityOptions(label), ['whole', 'half', 'serving']);
    assert.deepEqual(getAvailableQuantityOptions(servingOnly), ['serving']);
    assert.deepEqual(getAvailableQuantityOptions(nothing), []);
    assert.deepEqual(getAvailableQuantityOptions(multipack), [
      'whole',
      'half',
      'serving',
      'piece',
    ]);
    assert.deepEqual(getAvailableQuantityOptions(nonsenseServing), ['whole', 'half']);
  });

  it('defaults to serving, then package, then null', () => {
    assert.equal(getDefaultOption(label), 'serving');
    assert.equal(getDefaultOption(servingOnly), 'serving');
    assert.equal(getDefaultOption({ quantityGrams: 500, servingSizeGrams: null }), 'whole');
    assert.equal(getDefaultOption(nothing), null);
    assert.equal(getDefaultOption(nonsenseServing), 'whole');
  });

  it('resolves each option to grams', () => {
    assert.equal(getQuantityGramsForOption('whole', label, 100), 500);
    assert.equal(getQuantityGramsForOption('half', label, 100), 250);
    assert.equal(getQuantityGramsForOption('serving', label, 100), 40);
    assert.equal(getQuantityGramsForOption('piece', multipack, 100), 25);
    // No package size: 'whole' falls back to the custom amount.
    assert.equal(getQuantityGramsForOption('whole', servingOnly, 100), 100);
  });

  it('prefers the serving size as the custom default', () => {
    assert.equal(getDefaultCustomGrams(label, 100), 40);
    assert.equal(getDefaultCustomGrams(nothing, 100), 100);
  });
});
