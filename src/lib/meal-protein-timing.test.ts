import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeProteinTimingStats,
  pickProteinTimingHint,
  PROTEIN_TIMING_LOW_SHARE_RATIO,
  PROTEIN_TIMING_MIN_MEALS,
  type ProteinTimingStats,
} from './meal-protein-timing.ts';

function logged(date: string, time: string, totalCalories: number, proteinG: number | null) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return {
    date,
    eatenAt: new Date(y!, m! - 1, d!, h!, min!).toISOString(),
    totalCalories,
    proteinG,
  };
}

function stats(overrides: Partial<ProteinTimingStats> = {}): ProteinTimingStats {
  return {
    breakfast: { averageProteinG: 30, mealCount: 7 },
    lunch: { averageProteinG: 30, mealCount: 7 },
    snack: { averageProteinG: 5, mealCount: 7 },
    dinner: { averageProteinG: 30, mealCount: 7 },
    ...overrides,
  };
}

describe('computeProteinTimingStats', () => {
  it('averages protein per meal of each kind over grouped meals', () => {
    const result = computeProteinTimingStats({
      todayKey: '2026-09-25',
      meals: [
        // Breakfast 22nd: 08:00 + 08:30 → one meal with 12 g.
        logged('2026-09-22', '08:00', 300, 8),
        logged('2026-09-22', '08:30', 100, 4),
        logged('2026-09-23', '08:00', 350, 16),
        logged('2026-09-22', '12:30', 700, 40),
        logged('2026-09-22', '16:00', 200, 6),
        logged('2026-09-22', '19:00', 800, 35),
      ],
    });
    assert.deepEqual(result.breakfast, { averageProteinG: 14, mealCount: 2 });
    assert.deepEqual(result.lunch, { averageProteinG: 40, mealCount: 1 });
    assert.deepEqual(result.snack, { averageProteinG: 6, mealCount: 1 });
    assert.deepEqual(result.dinner, { averageProteinG: 35, mealCount: 1 });
  });

  it('leaves out today, small meals and meals without protein data', () => {
    const result = computeProteinTimingStats({
      todayKey: '2026-09-25',
      meals: [
        logged('2026-09-25', '08:00', 400, 5),
        logged('2026-09-24', '08:00', 80, 2),
        logged('2026-09-23', '08:00', 400, null),
        logged('2026-09-22', '08:00', 400, 20),
      ],
    });
    assert.deepEqual(result.breakfast, { averageProteinG: 20, mealCount: 1 });
    assert.deepEqual(result.lunch, { averageProteinG: null, mealCount: 0 });
  });
});

describe('pickProteinTimingHint', () => {
  it('uses 60 % of an even share and at least 3 meals', () => {
    assert.equal(PROTEIN_TIMING_LOW_SHARE_RATIO, 0.6);
    assert.equal(PROTEIN_TIMING_MIN_MEALS, 3);
  });

  it('flags a clearly low breakfast with a suggested range', () => {
    // Goal 90 g → even share 30 g; 12 g is 40 % → gap 18 g → 15–20 g.
    const hint = pickProteinTimingHint({
      stats: stats({ breakfast: { averageProteinG: 12, mealCount: 5 } }),
      dailyProteinGoalG: 90,
    });
    assert.deepEqual(hint, {
      slot: 'breakfast',
      averageProteinG: 12,
      addFromG: 15,
      addToG: 20,
    });
  });

  it('stays quiet exactly at 60 % of the even share', () => {
    const hint = pickProteinTimingHint({
      stats: stats({ lunch: { averageProteinG: 18, mealCount: 5 } }),
      dailyProteinGoalG: 90,
    });
    assert.equal(hint, null);
  });

  it('flags just under 60 %', () => {
    const hint = pickProteinTimingHint({
      stats: stats({ lunch: { averageProteinG: 17.9, mealCount: 5 } }),
      dailyProteinGoalG: 90,
    });
    assert.equal(hint?.slot, 'lunch');
    assert.equal(hint?.averageProteinG, 18);
    assert.equal(hint?.addFromG, 10);
    assert.equal(hint?.addToG, 15);
  });

  it('needs at least 3 meals of that kind', () => {
    const hint = pickProteinTimingHint({
      stats: stats({ dinner: { averageProteinG: 5, mealCount: 2 } }),
      dailyProteinGoalG: 90,
    });
    assert.equal(hint, null);
  });

  it('never flags snacks', () => {
    const hint = pickProteinTimingHint({
      stats: stats({ snack: { averageProteinG: 0, mealCount: 7 } }),
      dailyProteinGoalG: 150,
    });
    assert.equal(hint, null);
  });

  it('picks the main meal furthest below, ties go to the earlier meal', () => {
    const furthest = pickProteinTimingHint({
      stats: stats({
        breakfast: { averageProteinG: 15, mealCount: 5 },
        dinner: { averageProteinG: 10, mealCount: 5 },
      }),
      dailyProteinGoalG: 90,
    });
    assert.equal(furthest?.slot, 'dinner');

    const tie = pickProteinTimingHint({
      stats: stats({
        lunch: { averageProteinG: 10, mealCount: 5 },
        dinner: { averageProteinG: 10, mealCount: 5 },
      }),
      dailyProteinGoalG: 90,
    });
    assert.equal(tie?.slot, 'lunch');
  });

  it('suggests at least 5–10 g', () => {
    // Share 50 g, average 29.5 g (59 %) → gap 20.5 → 20–25; tiny gaps floor at 5.
    const hint = pickProteinTimingHint({
      stats: stats({ breakfast: { averageProteinG: 29.5, mealCount: 5 } }),
      dailyProteinGoalG: 150,
    });
    assert.equal(hint?.addFromG, 20);
    const small = pickProteinTimingHint({
      stats: stats({ breakfast: { averageProteinG: 1, mealCount: 5 } }),
      dailyProteinGoalG: 9,
    });
    assert.equal(small?.addFromG, 5);
    assert.equal(small?.addToG, 10);
  });

  it('needs a protein goal', () => {
    const low = stats({ breakfast: { averageProteinG: 1, mealCount: 5 } });
    assert.equal(pickProteinTimingHint({ stats: low, dailyProteinGoalG: null }), null);
    assert.equal(pickProteinTimingHint({ stats: low, dailyProteinGoalG: 0 }), null);
  });
});
