export type HistoryMacroNutrient = 'protein' | 'carbs' | 'fat' | 'fiber';

export const HISTORY_MACRO_NUTRIENTS: HistoryMacroNutrient[] = [
  'protein',
  'carbs',
  'fat',
  'fiber',
];

type MacroGrams = {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

export type HistoryMacroDay = {
  macros: MacroGrams;
  goal: MacroGrams | null;
  scaledGoal: MacroGrams | null;
};

function gramsFor(
  macros: MacroGrams | null | undefined,
  nutrient: HistoryMacroNutrient,
): number | null {
  if (macros == null) {
    return null;
  }
  switch (nutrient) {
    case 'protein':
      return macros.proteinG;
    case 'carbs':
      return macros.carbsG;
    case 'fat':
      return macros.fatG;
    case 'fiber':
      return macros.fiberG;
  }
}

/** Logged intake; null on days without meals so the line does not drop to 0 g. */
export function historyMacroActualSeries(
  days: readonly HistoryMacroDay[],
  nutrient: HistoryMacroNutrient,
): Array<number | null> {
  return days.map((day) => gramsFor(day.macros, nutrient));
}

/**
 * Goal line for that calendar day: sport-scaled carbs/fat when present,
 * otherwise the calorie_goals row as of that date. Protein and fiber are not
 * training-scaled, so their series is flat unless the stored goal changed.
 * Scaling is reconstructed at read time with the current adapt-to-training
 * preference and current weight — see fetchHistoryData.
 */
export function historyMacroGoalSeries(
  days: readonly HistoryMacroDay[],
  nutrient: HistoryMacroNutrient,
): Array<number | null> {
  return days.map((day) => {
    const scaled = gramsFor(day.scaledGoal, nutrient);
    if (scaled != null) {
      return scaled;
    }
    return gramsFor(day.goal, nutrient);
  });
}

// ---------------------------------------------------------------------------
// Chart scale, summary line and point bubble
// ---------------------------------------------------------------------------

/** Air above the highest value or goal. */
export const MACRO_CHART_HEADROOM = 0.15;

/** Steps the axis maximum rounds up to, by size. */
function niceStep(value: number): number {
  if (value <= 20) return 5;
  if (value <= 100) return 10;
  if (value <= 300) return 25;
  return 50;
}

/**
 * Y axis for the macro chart: always from 0, up to the highest value or goal
 * plus MACRO_CHART_HEADROOM, rounded up to a round number. Same for all four
 * macros.
 */
export function macroChartDomain(
  series: ReadonlyArray<ReadonlyArray<number | null | undefined>>,
): { min: number; max: number; range: number } {
  let highest = 0;
  for (const row of series) {
    for (const value of row) {
      if (value != null && Number.isFinite(value) && value > highest) {
        highest = value;
      }
    }
  }
  const withAir = Math.max(1, highest * (1 + MACRO_CHART_HEADROOM));
  const step = niceStep(withAir);
  const max = Math.ceil(withAir / step) * step;
  return { min: 0, max, range: max };
}

/** Carbs and fat: in target within this share around the day's goal. */
export const MACRO_TARGET_TOLERANCE = 0.1;

/**
 * A day in target: protein and fiber at least the goal (same rule as
 * isProteinGoalHit); carbs and fat within ±MACRO_TARGET_TOLERANCE.
 */
export function isMacroDayInTarget(
  nutrient: HistoryMacroNutrient,
  actual: number | null,
  goal: number | null,
): boolean {
  if (actual == null || goal == null || !(goal > 0)) {
    return false;
  }
  if (nutrient === 'protein' || nutrient === 'fiber') {
    return actual >= goal;
  }
  return Math.abs(actual - goal) <= goal * MACRO_TARGET_TOLERANCE;
}

export type MacroTrendSummary = {
  /** Mean intake over closed days with meals, rounded g. */
  avg: number | null;
  /** Mean of those days' goals (the goal can change within the range). */
  goal: number | null;
  hit: number;
  /** Closed days with meals. */
  days: number;
};

/**
 * Summary under the chart. Today is still running: it neither counts as a
 * miss nor into the averages.
 */
export function macroTrendSummary(params: {
  nutrient: HistoryMacroNutrient;
  dates: readonly string[];
  actual: ReadonlyArray<number | null>;
  goal: ReadonlyArray<number | null>;
  todayKey: string;
}): MacroTrendSummary {
  let sum = 0;
  let days = 0;
  let goalSum = 0;
  let goalDays = 0;
  let hit = 0;
  params.dates.forEach((date, index) => {
    if (date === params.todayKey) {
      return;
    }
    const actual = params.actual[index] ?? null;
    if (actual == null) {
      return;
    }
    const goal = params.goal[index] ?? null;
    sum += actual;
    days += 1;
    if (goal != null && goal > 0) {
      goalSum += goal;
      goalDays += 1;
    }
    if (isMacroDayInTarget(params.nutrient, actual, goal)) {
      hit += 1;
    }
  });
  return {
    avg: days > 0 ? Math.round(sum / days) : null,
    goal: goalDays > 0 ? Math.round(goalSum / goalDays) : null,
    hit,
    days,
  };
}

/** Indices where the goal differs from the day before (both known). */
export function macroGoalChangeIndices(goal: ReadonlyArray<number | null>): Set<number> {
  const out = new Set<number>();
  let previous: number | null = null;
  goal.forEach((value, index) => {
    if (value == null) {
      return;
    }
    if (previous != null && Math.round(value) !== Math.round(previous)) {
      out.add(index);
    }
    previous = value;
  });
  return out;
}

/** Nearest day index for a touch at `x` over the plotted width. */
export function macroIndexAtX(params: {
  x: number;
  count: number;
  width: number;
  padding: number;
}): number {
  if (params.count <= 1) {
    return 0;
  }
  const inner = params.width - params.padding * 2;
  const ratio = (params.x - params.padding) / inner;
  const index = Math.round(ratio * (params.count - 1));
  return Math.min(params.count - 1, Math.max(0, index));
}

export type MacroBubbleTranslate = (key: string, options?: Record<string, unknown>) => string;

/** "Di · 158 von 163 g", "Di · 158 g" without a goal; null without intake. */
export function macroBubbleText(params: {
  dayLabel: string;
  actual: number | null;
  goal: number | null;
  t: MacroBubbleTranslate;
}): string | null {
  if (params.actual == null) {
    return null;
  }
  const value = Math.round(params.actual);
  return params.goal != null && params.goal > 0
    ? params.t('history.macro.bubble', { day: params.dayLabel, value, goal: Math.round(params.goal) })
    : params.t('history.macro.bubbleNoGoal', { day: params.dayLabel, value });
}
