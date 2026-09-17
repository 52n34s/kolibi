import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balanceMacroGoalsToCalories } from './macro-display-balance.ts';
import { FAT_G_PER_KG_FLOOR } from './macro-rules.ts';
import {
  MACRO_KCAL_TOLERANCE,
  MIN_CARBS_G_PER_KG_BODY_WEIGHT,
} from './sport-macro-scaling.ts';

/**
 * The reported case. Reference mass is the 77 kg target weight, not the 87.5 kg
 * body weight — min() picks the floored target, which is why stored fat sits at
 * 54 g (0.7 × 77) and protein at 155 g (1.8 × 1.12 vegan × 77).
 */
const STORED = { proteinG: 155, fatG: 54, carbsG: 63 };
const REF_KG = 77;
const BODY_KG = 87.5;

function sumKcal(macros: { proteinG: number; fatG: number; carbsG: number }): number {
  return macros.proteinG * 4 + macros.fatG * 9 + macros.carbsG * 4;
}

describe('balanceMacroGoalsToCalories', () => {
  it('lifts carbohydrate so the bars add up to the shown calories', () => {
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 1539,
      ...STORED,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    assert.equal(balanced.proteinG, STORED.proteinG, 'protein must not move');
    assert.equal(balanced.fatG, STORED.fatG, 'fat stays put while carbs have room');
    assert.ok(balanced.carbsG > STORED.carbsG);
    assert.ok(Math.abs(sumKcal(balanced) - 1539) <= MACRO_KCAL_TOLERANCE);
  });

  it('leaves goals untouched when they already match', () => {
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: sumKcal(STORED),
      ...STORED,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    assert.deepEqual(balanced, STORED);
  });

  it('gives fat calories back to the remainder until it reaches 2 g/kg', () => {
    // Fat sits far enough above its floor to fund the whole transfer, so the
    // remainder — not the fat floor — is what stops it.
    const fatty = { proteinG: 130, fatG: 120, carbsG: 150 };
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 2000,
      ...fatty,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    // Lands on the 2 g/kg mark up to a gram of rounding between fat and carbs.
    assert.ok(
      Math.abs(balanced.carbsG - MIN_CARBS_G_PER_KG_BODY_WEIGHT * BODY_KG) <= 1,
      `${balanced.carbsG} vs ${MIN_CARBS_G_PER_KG_BODY_WEIGHT * BODY_KG}`,
    );
    assert.ok(balanced.fatG < fatty.fatG, 'fat funded the remainder');
    assert.ok(
      balanced.fatG > Math.round(FAT_G_PER_KG_FLOOR * REF_KG),
      'fat still has slack, so the remainder is what stopped the transfer',
    );
    assert.ok(Math.abs(sumKcal(balanced) - 2000) <= MACRO_KCAL_TOLERANCE);
  });

  it('never pushes fat below its 0.7 g/kg floor', () => {
    const minFatG = Math.floor(FAT_G_PER_KG_FLOOR * REF_KG);
    // Below protein + minimum fat there is nothing left to distribute.
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 1100,
      ...STORED,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    assert.ok(balanced.fatG >= minFatG, `${balanced.fatG} < ${minFatG}`);
    assert.ok(balanced.carbsG >= 0);
  });

  it('keeps the sum when 2 g/kg is out of reach at a deficit target', () => {
    // 155 g protein + the 54 g fat floor already eat 1106 of 1539 kcal, so the
    // remainder cannot reach 2 g/kg. Matching the shown number wins.
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 1539,
      ...STORED,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    assert.ok(balanced.carbsG < MIN_CARBS_G_PER_KG_BODY_WEIGHT * BODY_KG);
    assert.ok(Math.abs(sumKcal(balanced) - 1539) <= MACRO_KCAL_TOLERANCE);
  });

  it('moves overflow into fat at the 10 g/kg carbohydrate cap', () => {
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 6000,
      ...STORED,
      bodyWeightKg: BODY_KG,
      refWeightKg: REF_KG,
    });

    assert.ok(balanced.carbsG <= Math.round(10 * BODY_KG));
    assert.ok(balanced.fatG > STORED.fatG, 'fat took the overflow');
  });

  it('drops the g/kg bounds when no reference mass is known', () => {
    const balanced = balanceMacroGoalsToCalories({
      targetKcal: 1539,
      ...STORED,
      bodyWeightKg: null,
      refWeightKg: null,
    });

    assert.ok(Math.abs(sumKcal(balanced) - 1539) <= MACRO_KCAL_TOLERANCE);
  });
});
