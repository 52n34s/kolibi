import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MACRO_KCAL_TOLERANCE,
  MAX_CARBS_G_PER_KG_BODY_WEIGHT,
  SPORT_INTENSITY_CARB_FRACTION,
  SPORT_KCAL_MACRO_SPLIT,
  SportIntensity,
  aggregateSportMacroEnergy,
  classifyIntensityByHeartRate,
  classifyIntensityByWorkoutActivityType,
  resolveSportIntensity,
  scaleMacrosForSportCalories,
  sportKcalToMacroGrams,
} from './sport-macro-scaling.ts';

function macroKcal(proteinG: number, fatG: number, carbsG: number): number {
  return proteinG * 4 + fatG * 9 + carbsG * 4;
}

describe('SPORT_INTENSITY_CARB_FRACTION', () => {
  it('keeps intensity carb shares as a named map', () => {
    assert.equal(SPORT_INTENSITY_CARB_FRACTION.LOW, 0.5);
    assert.equal(SPORT_INTENSITY_CARB_FRACTION.MODERATE, 0.8);
    assert.equal(SPORT_INTENSITY_CARB_FRACTION.HIGH, 0.95);
  });

  it('keeps SPORT_KCAL_MACRO_SPLIT as the MODERATE 80/20 alias', () => {
    assert.equal(SPORT_KCAL_MACRO_SPLIT.carbs, 0.8);
    assert.equal(SPORT_KCAL_MACRO_SPLIT.fat, 0.2);
  });
});

describe('sportKcalToMacroGrams — acceptance', () => {
  it('walk 250 kcal LOW → +31 g carbs, +14 g fat', () => {
    const part = sportKcalToMacroGrams(250, SportIntensity.LOW);
    assert.equal(Math.round(part.carbsG), 31);
    assert.equal(Math.round(part.fatG), 14);
  });

  it('run 651 kcal MODERATE → +130 g carbs, +14 g fat', () => {
    const part = sportKcalToMacroGrams(651, SportIntensity.MODERATE);
    assert.equal(Math.round(part.carbsG), 130);
    assert.equal(Math.round(part.fatG), 14);
  });
});

describe('aggregateSportMacroEnergy — per workout, not averaged', () => {
  it('splits a mixed day per segment then sums', () => {
    const aggregated = aggregateSportMacroEnergy([
      { kcal: 250, intensity: SportIntensity.LOW },
      { kcal: 350, intensity: SportIntensity.MODERATE },
    ]);
    assert.equal(aggregated.carbsKcal, 250 * 0.5 + 350 * 0.8);
    assert.equal(aggregated.fatKcal, 250 * 0.5 + 350 * 0.2);
    assert.equal(aggregated.carbsKcal, 405);
    assert.equal(aggregated.fatKcal, 195);
  });

  it('does not equal a single averaged intensity over total kcal', () => {
    const aggregated = aggregateSportMacroEnergy([
      { kcal: 250, intensity: SportIntensity.LOW },
      { kcal: 350, intensity: SportIntensity.MODERATE },
    ]);
    const wrongAverage = sportKcalToMacroGrams(600, SportIntensity.MODERATE);
    assert.notEqual(aggregated.carbsKcal, wrongAverage.carbsKcal);
  });
});

describe('classifyIntensity', () => {
  it('uses HR fraction thresholds', () => {
    const maxHr = 190; // age 30
    assert.equal(classifyIntensityByHeartRate(maxHr * 0.5, maxHr), SportIntensity.LOW);
    assert.equal(classifyIntensityByHeartRate(maxHr * 0.7, maxHr), SportIntensity.MODERATE);
    assert.equal(classifyIntensityByHeartRate(maxHr * 0.9, maxHr), SportIntensity.HIGH);
  });

  it('maps workout activity types with MODERATE fallback', () => {
    assert.equal(classifyIntensityByWorkoutActivityType(52), SportIntensity.LOW); // walking
    assert.equal(classifyIntensityByWorkoutActivityType(37), SportIntensity.MODERATE); // running
    assert.equal(classifyIntensityByWorkoutActivityType(63), SportIntensity.HIGH); // HIIT
    assert.equal(classifyIntensityByWorkoutActivityType(3000), SportIntensity.MODERATE); // other
  });

  it('skips HR path when age is missing', () => {
    assert.equal(
      resolveSportIntensity({
        averageHrBpm: 150,
        ageYears: null,
        activityType: 52,
      }),
      SportIntensity.LOW,
    );
  });
});

describe('scaleMacrosForSportCalories', () => {
  it('returns basis macros unchanged when sport energy is 0', () => {
    const result = scaleMacrosForSportCalories({
      basisKcal: 1665,
      sportKcal: 0,
      proteinG: 155,
      fatBasisG: 54,
      carbsBasisG: 140,
      weightKg: 80,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.proteinG, 155);
    assert.equal(result.fatG, 54);
    assert.equal(result.carbsG, 140);
    assert.equal(result.carbsFromSportG, 0);
  });

  it('scales fat/carbs for basis 1665 + sport 651 MODERATE with fixed protein 155', () => {
    const result = scaleMacrosForSportCalories({
      basisKcal: 1665,
      segments: [{ kcal: 651, intensity: SportIntensity.MODERATE }],
      proteinG: 155,
      fatBasisG: 54,
      carbsBasisG: 140,
      weightKg: 80,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.proteinG, 155);
    assert.equal(result.fatG, 68);
    assert.equal(result.carbsG, 271);
    assert.equal(result.carbsFromSportG, 131);
    assert.equal(macroKcal(result.proteinG, result.fatG, result.carbsG), 2316);
  });

  it('applies LOW walk increments onto basis macros', () => {
    const result = scaleMacrosForSportCalories({
      basisKcal: 1665,
      segments: [{ kcal: 250, intensity: SportIntensity.LOW }],
      proteinG: 155,
      fatBasisG: 54,
      carbsBasisG: 140,
      weightKg: 80,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.fatG, 54 + 14);
    assert.equal(result.carbsFromSportG, 31);
  });

  it('keeps macro kcal within ±2 of total for varied sport loads', () => {
    for (const sportKcal of [0, 100, 300, 651, 900]) {
      const result = scaleMacrosForSportCalories({
        basisKcal: 1665,
        sportKcal,
        proteinG: 155,
        fatBasisG: 54,
        carbsBasisG: 140,
        weightKg: 80,
      });
      assert.equal(result.ok, true);
      if (!result.ok) {
        continue;
      }
      const kcal = macroKcal(result.proteinG, result.fatG, result.carbsG);
      assert.ok(
        Math.abs(kcal - result.totalKcal) <= MACRO_KCAL_TOLERANCE,
        `sport=${sportKcal}: ${kcal} vs ${result.totalKcal}`,
      );
      assert.equal(result.proteinG, 155);
    }
  });

  it('moves carbs above 10 g/kg into fat', () => {
    const weightKg = 60;
    const maxCarbs = MAX_CARBS_G_PER_KG_BODY_WEIGHT * weightKg;
    const result = scaleMacrosForSportCalories({
      basisKcal: 2000,
      sportKcal: 2000,
      proteinG: 100,
      fatBasisG: 40,
      carbsBasisG: 250,
      weightKg,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.carbsG <= maxCarbs);
    assert.ok(result.fatG > 40);
    assert.ok(
      Math.abs(macroKcal(result.proteinG, result.fatG, result.carbsG) - result.totalKcal) <=
        MACRO_KCAL_TOLERANCE,
    );
  });

  it('blocks when protein + fat energy exceeds the calorie target', () => {
    const result = scaleMacrosForSportCalories({
      basisKcal: 1200,
      sportKcal: 0,
      proteinG: 250,
      fatBasisG: 80,
      carbsBasisG: 0,
      weightKg: 80,
    });

    assert.equal(result.ok, true);

    const withSport = scaleMacrosForSportCalories({
      basisKcal: 1000,
      sportKcal: 50,
      proteinG: 200,
      fatBasisG: 80,
      carbsBasisG: 10,
      weightKg: 80,
    });
    assert.equal(withSport.ok, false);
    if (withSport.ok) {
      return;
    }
    assert.equal(withSport.reason, 'protein_fat_exceed_calories');
  });
});
