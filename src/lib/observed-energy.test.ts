import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OBSERVED_READY_MIN_ELIGIBLE_DAYS,
  OBSERVED_ROUGH_MIN_ELIGIBLE_DAYS,
  OBSERVED_SUGGESTION_MIN_DELTA_KCAL,
  OBSERVED_WINDOW_DAYS,
  buildObservedWindowDateKeys,
  computeObservedEnergy,
  observedPromptDismissedUntil,
  shouldOfferObservedGoalUpdate,
  type ObservedMealInput,
  type ObservedWeightInput,
} from './observed-energy.ts';

const TODAY = new Date(2026, 8, 17); // 17 Sep 2026 local
/** Resting metabolism behind the 2400 kcal TDEE fixture (factor ~1.37). */
const BMR_KCAL = 1750;

function dateKeyOffset(daysBeforeToday: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysBeforeToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Two qualifying meals on a day. */
function mealsForDay(dateKey: string, totalKcal: number): ObservedMealInput[] {
  const half = totalKcal / 2;
  return [
    { dateKey, totalKcal: half },
    { dateKey, totalKcal: half },
  ];
}

function buildEligibleMeals(eligibleCount: number, dailyKcal = 2200): ObservedMealInput[] {
  const meals: ObservedMealInput[] = [];
  // Window days are offsets 1..28 from today.
  for (let i = 1; i <= OBSERVED_WINDOW_DAYS; i += 1) {
    const key = dateKeyOffset(i);
    if (i <= eligibleCount) {
      meals.push(...mealsForDay(key, dailyKcal));
    }
  }
  return meals;
}

function buildWeights(count: number, startKg: number, endKg: number): ObservedWeightInput[] {
  const weights: ObservedWeightInput[] = [];
  // Dense enough for a 7-day trailing MA (min 3 samples per window).
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    const kg = startKg + (endKg - startKg) * t;
    // Spread from day 27-ago to day 1-ago (inside the closed window).
    const daysBefore =
      27 - Math.round((i / Math.max(1, count - 1)) * 26);
    const d = new Date(TODAY);
    d.setDate(d.getDate() - daysBefore);
    d.setHours(12, 0, 0, 0);
    weights.push({ weightKg: Math.round(kg * 10) / 10, loggedAt: d });
  }
  return weights;
}

describe('buildObservedWindowDateKeys', () => {
  it('returns 28 keys ending yesterday', () => {
    const keys = buildObservedWindowDateKeys(TODAY);
    assert.equal(keys.length, 28);
    assert.equal(keys[keys.length - 1], dateKeyOffset(1));
    assert.equal(keys[0], dateKeyOffset(28));
    assert.ok(!keys.includes(dateKeyOffset(0)));
  });
});

describe('computeObservedEnergy', () => {
  it('returns insufficient below 18 eligible days', () => {
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(17),
      weights: buildWeights(8, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
    if (result.status === 'insufficient') {
      assert.equal(result.reason, 'eligible_days');
      assert.equal(result.eligibleDays, 17);
    }
  });

  it('returns rough for 18–20 eligible days', () => {
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(OBSERVED_ROUGH_MIN_ELIGIBLE_DAYS),
      weights: buildWeights(14, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'rough');
    if (result.status === 'rough') {
      assert.equal(result.eligibleDays, 18);
      assert.ok(result.observedKcal > 0);
    }
  });

  it('returns ready at 21+ eligible days and applies energy balance', () => {
    // Flat intake 2200, lose ~1 kg over ~26 days → add ~7700/26 ≈ 296 → ~2496
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(OBSERVED_READY_MIN_ELIGIBLE_DAYS),
      weights: buildWeights(14, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'ready');
    if (result.status === 'ready') {
      assert.ok(result.eligibleDays >= 21);
      assert.ok(result.observedKcal > 2200);
      assert.ok(result.weightDeltaKg < 0);
    }
  });

  it('excludes legacy days where protein_g coalesced to 0 with positive kcal', () => {
    const meals: ObservedMealInput[] = [];
    for (let i = 1; i <= OBSERVED_WINDOW_DAYS; i += 1) {
      const key = dateKeyOffset(i);
      // Enough kcal shape to look eligible — but protein 0 marks a macro gap.
      meals.push(
        { dateKey: key, totalKcal: 1100, proteinG: 0 },
        { dateKey: key, totalKcal: 1100, proteinG: 0 },
      );
    }
    const result = computeObservedEnergy({
      meals,
      weights: buildWeights(14, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
    if (result.status === 'insufficient') {
      assert.equal(result.reason, 'no_intake');
      assert.equal(result.eligibleDays, 0);
    }
  });

  it('rejects days with fewer than two meals over 100 kcal', () => {
    const meals: ObservedMealInput[] = [];
    for (let i = 1; i <= 28; i += 1) {
      meals.push({ dateKey: dateKeyOffset(i), totalKcal: 2200 });
    }
    const result = computeObservedEnergy({
      meals,
      weights: buildWeights(14, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
  });

  it('rejects implausible estimates vs BMR-based maintenance', () => {
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(25, 900),
      weights: buildWeights(14, 80, 80),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
    if (result.status === 'insufficient') {
      assert.equal(result.reason, 'plausibility');
    }
  });

  it('rejects a measured expenditure below resting metabolism', () => {
    // 1500 sits above the old 0.55 × TDEE band (1320) and below the BMR, so the
    // band used to wave it through. Eating your way to sub-BMR expenditure is a
    // data gap, not physiology.
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(25, 1500),
      weights: buildWeights(14, 80, 80),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
    if (result.status === 'insufficient') {
      assert.equal(result.reason, 'plausibility');
    }
  });

  it('requires enough weigh days', () => {
    const result = computeObservedEnergy({
      meals: buildEligibleMeals(25),
      weights: buildWeights(2, 80, 79),
      estimatedMaintenanceKcal: 2400,
      bmrKcal: BMR_KCAL,
      today: TODAY,
    });
    assert.equal(result.status, 'insufficient');
    if (result.status === 'insufficient') {
      assert.equal(result.reason, 'weigh_days');
    }
  });
});

describe('shouldOfferObservedGoalUpdate', () => {
  it('offers only when ready, not custom, delta ≥ 100, not dismissed', () => {
    assert.equal(
      shouldOfferObservedGoalUpdate({
        status: 'ready',
        observedKcal: 2340,
        currentMaintenanceKcal: 2212,
        calorieGoalSource: 'calculated',
      }),
      true,
    );
    assert.equal(
      shouldOfferObservedGoalUpdate({
        status: 'rough',
        observedKcal: 2340,
        currentMaintenanceKcal: 2212,
        calorieGoalSource: 'calculated',
      }),
      false,
    );
    assert.equal(
      shouldOfferObservedGoalUpdate({
        status: 'ready',
        observedKcal: 2340,
        currentMaintenanceKcal: 2212,
        calorieGoalSource: 'custom',
      }),
      false,
    );
    assert.equal(
      shouldOfferObservedGoalUpdate({
        status: 'ready',
        observedKcal: 2212 + OBSERVED_SUGGESTION_MIN_DELTA_KCAL - 1,
        currentMaintenanceKcal: 2212,
        calorieGoalSource: 'calculated',
      }),
      false,
    );
    assert.equal(
      shouldOfferObservedGoalUpdate({
        status: 'ready',
        observedKcal: 2340,
        currentMaintenanceKcal: 2212,
        calorieGoalSource: 'calculated',
        dismissedUntil: '2099-01-01',
        today: TODAY,
      }),
      false,
    );
  });

  it('dismissedUntil is seven days after today', () => {
    assert.equal(observedPromptDismissedUntil(TODAY), '2026-09-24');
  });
});
