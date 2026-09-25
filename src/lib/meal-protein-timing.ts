/**
 * Protein by time of day over the balance window (7 days).
 *
 * Basis: entries grouped into meals (meal-groups), only meals of at least
 * 100 kcal with protein data (same basis as the protein distribution), only
 * closed days (today is still in progress).
 *
 * Average = mean protein per meal of that kind, over the meals that happened
 * (a skipped breakfast does not pull the breakfast average down).
 *
 * "Clearly below" (one hint sentence): breakfast, lunch and dinner are
 * compared to an even share of the daily protein goal across the three main
 * meals (goal ÷ 3). A main meal is clearly below when its average is under
 * 60 % of that share and it happened on at least 3 days. Snacks are reported
 * but never trigger the hint — they are optional by nature.
 */
import {
  proteinCountableMealGroups,
  type ProteinDistributionMeal,
} from '@/lib/history-balance-stats';
import type { MealSlot } from '@/lib/meal-groups';

export type MainMealSlot = 'breakfast' | 'lunch' | 'dinner';

export const MAIN_MEAL_SLOTS: readonly MainMealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** Main meal is "clearly below" under this fraction of goal ÷ 3. */
export const PROTEIN_TIMING_LOW_SHARE_RATIO = 0.6;
/** A main meal needs this many occurrences before it can trigger the hint. */
export const PROTEIN_TIMING_MIN_MEALS = 3;
const SUGGESTION_STEP_G = 5;

export type ProteinTimingSlotStats = {
  /** Mean protein per meal of this kind; null when none happened. */
  averageProteinG: number | null;
  mealCount: number;
};

export type ProteinTimingStats = Record<MealSlot, ProteinTimingSlotStats>;

export type ProteinTimingHint = {
  slot: MainMealSlot;
  /** Rounded average protein per meal of this kind. */
  averageProteinG: number;
  /** Suggested extra protein range, e.g. 15–20 g. */
  addFromG: number;
  addToG: number;
};

export function computeProteinTimingStats(params: {
  meals: readonly ProteinDistributionMeal[];
  /** Local day key of today; meals on or after it are left out. */
  todayKey: string;
}): ProteinTimingStats {
  const sums: Record<MealSlot, { protein: number; count: number }> = {
    breakfast: { protein: 0, count: 0 },
    lunch: { protein: 0, count: 0 },
    snack: { protein: 0, count: 0 },
    dinner: { protein: 0, count: 0 },
  };

  for (const meal of proteinCountableMealGroups(params.meals)) {
    if (meal.date >= params.todayKey || meal.proteinG == null) {
      continue;
    }
    sums[meal.slot].protein += meal.proteinG;
    sums[meal.slot].count += 1;
  }

  const toStats = (slot: MealSlot): ProteinTimingSlotStats => ({
    averageProteinG: sums[slot].count > 0 ? sums[slot].protein / sums[slot].count : null,
    mealCount: sums[slot].count,
  });

  return {
    breakfast: toStats('breakfast'),
    lunch: toStats('lunch'),
    snack: toStats('snack'),
    dinner: toStats('dinner'),
  };
}

/**
 * Picks the main meal furthest below its even share (see file header), or
 * null when every main meal is close enough or the data is too thin.
 * Ties go to the earlier meal of the day.
 */
export function pickProteinTimingHint(params: {
  stats: ProteinTimingStats;
  dailyProteinGoalG: number | null;
}): ProteinTimingHint | null {
  const goal = params.dailyProteinGoalG;
  if (goal == null || !(goal > 0)) {
    return null;
  }
  const evenShareG = goal / MAIN_MEAL_SLOTS.length;

  let best: { slot: MainMealSlot; average: number; ratio: number } | null = null;
  for (const slot of MAIN_MEAL_SLOTS) {
    const { averageProteinG, mealCount } = params.stats[slot];
    if (averageProteinG == null || mealCount < PROTEIN_TIMING_MIN_MEALS) {
      continue;
    }
    const ratio = averageProteinG / evenShareG;
    if (!(ratio < PROTEIN_TIMING_LOW_SHARE_RATIO)) {
      continue;
    }
    if (best == null || ratio < best.ratio) {
      best = { slot, average: averageProteinG, ratio };
    }
  }
  if (best == null) {
    return null;
  }

  const gapG = evenShareG - best.average;
  const addFromG = Math.max(
    SUGGESTION_STEP_G,
    Math.floor(gapG / SUGGESTION_STEP_G) * SUGGESTION_STEP_G,
  );
  return {
    slot: best.slot,
    averageProteinG: Math.round(best.average),
    addFromG,
    addToG: addFromG + SUGGESTION_STEP_G,
  };
}
