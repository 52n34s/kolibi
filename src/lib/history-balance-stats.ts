import type { HistorySummaryStats } from '@/lib/history';
import { FAT_G_PER_KG_FLOOR } from '@/lib/macro-rules';

export type BalanceNutrient = 'protein' | 'fiber' | 'fat';

/** Nutrients eligible for the balance-card summary sentence (never calories). */
export type BalanceSummaryNutrient = 'protein' | 'fiber' | 'fat' | 'carbs';

export type BalanceStats = {
  proteinOk: boolean;
  proteinHasData: boolean;
  proteinAboveGoal: boolean;
  /** actual − goal, in grams. Negative = under goal. */
  proteinDeltaG: number | null;
  fiberOk: boolean;
  fiberHasData: boolean;
  /** actual − goal, in grams. Negative = under goal. */
  fiberDeltaG: number | null;
  fatOk: boolean;
  fatHasData: boolean;
  fatBelowFloor: boolean;
  fatOverGoal: boolean;
  /** actual − goal, in grams. Positive = over goal. */
  fatDeltaG: number | null;
  carbsHasData: boolean;
  carbsOk: boolean;
  carbsOverGoal: boolean;
  /** actual − goal, in grams. Positive = over goal. */
  carbsDeltaG: number | null;
  /** The failing metric with the largest relative gap to its threshold, if any. */
  deviatingNutrient: BalanceNutrient | null;
  allOk: boolean;
};

const BALANCE_TOLERANCE = 0.05;
const PROTEIN_DISTRIBUTION_G_PER_KG = 0.3;
const PROTEIN_DISTRIBUTION_ROUND_TO_G = 5;
const PROTEIN_DISTRIBUTION_MIN_MEAL_KCAL = 100;

export type ProteinDistributionMeal = {
  date: string;
  totalCalories: number;
  proteinG: number | null;
};

export type ProteinDistributionStats = {
  thresholdG: number;
  averageMealsAtThreshold: number;
  averageMealCount: number;
  trackedDays: number;
};

/** Data-density grade for balance-card values. */
export type BalanceAccuracy = 'reliable' | 'rough' | 'very_rough' | 'unavailable';

const ACCURACY_RANK: Record<BalanceAccuracy, number> = {
  reliable: 0,
  rough: 1,
  very_rough: 2,
  unavailable: 3,
};

/** Matches `history.weight.trendNeedsMeasurements` (~3 weigh-ins / week). */
export const TREND_MIN_WEIGH_INS_PER_WEEK = 3;
/** Same bar as the progress-tab hint: hide the kg-delta until a trend is reliable. */
export const TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH = 8;

/** Weight-rate row: need ≥2 weigh days and ≥7 days between first and last. */
export function accuracyFromWeighIns(params: {
  weighDayCount: number;
  spanDays: number;
}): BalanceAccuracy {
  const { weighDayCount, spanDays } = params;
  if (weighDayCount < 2 || spanDays < 7) {
    return 'unavailable';
  }
  if (weighDayCount >= TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH) {
    return 'reliable';
  }
  if (weighDayCount >= 4) {
    return 'rough';
  }
  return 'very_rough';
}

/**
 * Progress-tab "+X kg in Y days" line. Hidden while the "need ~3 weigh-ins a
 * week" hint is showing, and until the visible range itself has that many days.
 */
export function shouldShowWeightChangeDelta(params: {
  uniqueWeighDaysInRange: number;
  weighDaysLastMonth: number;
}): boolean {
  return (
    params.uniqueWeighDaysInRange >= TREND_MIN_WEIGH_INS_PER_WEEK &&
    params.weighDaysLastMonth >= TREND_RELIABLE_WEIGH_DAYS_LAST_MONTH
  );
}

/** Macro rows (protein / fiber / fat / carbs): based on tracked meal days. */
export function accuracyFromTrackedDays(trackedDays: number): BalanceAccuracy {
  if (trackedDays < 2) {
    return 'unavailable';
  }
  if (trackedDays >= 6) {
    return 'reliable';
  }
  if (trackedDays >= 4) {
    return 'rough';
  }
  return 'very_rough';
}

/** Protein-distribution row: days with complete macro meals. */
export function accuracyFromProteinDistributionDays(trackedDays: number): BalanceAccuracy {
  if (trackedDays < 1) {
    return 'unavailable';
  }
  if (trackedDays >= 5) {
    return 'reliable';
  }
  if (trackedDays >= 3) {
    return 'rough';
  }
  return 'very_rough';
}

export function isWeakerAccuracy(a: BalanceAccuracy, b: BalanceAccuracy): boolean {
  return ACCURACY_RANK[a] > ACCURACY_RANK[b];
}

/**
 * Append the rough/very-rough mark. Unavailable stays as an em dash.
 * very_rough values are styled secondary by the row renderer.
 */
export function formatBalanceAccuracyValue(
  value: string,
  accuracy: BalanceAccuracy,
): { text: string; tone: 'default' | 'secondary' } {
  if (accuracy === 'unavailable' || value === '—' || value === '–') {
    return { text: '—', tone: 'default' };
  }
  if (accuracy === 'reliable') {
    return { text: value, tone: 'default' };
  }
  return {
    text: `${value} •`,
    tone: accuracy === 'very_rough' ? 'secondary' : 'default',
  };
}

export type BalanceAccuracyHintKind = 'weigh_ins' | 'tracked_days';

/**
 * Pick a single hint for the weakest non-reliable row.
 * Preference when tied: weigh-ins, then macros, then protein distribution.
 */
export function pickBalanceAccuracyHint(candidates: {
  weighIns: { accuracy: BalanceAccuracy; count: number } | null;
  trackedDays: { accuracy: BalanceAccuracy; count: number } | null;
  proteinDistribution: { accuracy: BalanceAccuracy; count: number } | null;
}): { kind: BalanceAccuracyHintKind; count: number } | null {
  type Candidate = { kind: BalanceAccuracyHintKind; accuracy: BalanceAccuracy; count: number };
  const list: Candidate[] = [];
  if (candidates.weighIns && candidates.weighIns.accuracy !== 'reliable') {
    list.push({
      kind: 'weigh_ins',
      accuracy: candidates.weighIns.accuracy,
      count: candidates.weighIns.count,
    });
  }
  if (candidates.trackedDays && candidates.trackedDays.accuracy !== 'reliable') {
    list.push({
      kind: 'tracked_days',
      accuracy: candidates.trackedDays.accuracy,
      count: candidates.trackedDays.count,
    });
  }
  if (
    candidates.proteinDistribution &&
    candidates.proteinDistribution.accuracy !== 'reliable'
  ) {
    // Protein-distribution uses the same tracked-days hint copy.
    list.push({
      kind: 'tracked_days',
      accuracy: candidates.proteinDistribution.accuracy,
      count: candidates.proteinDistribution.count,
    });
  }
  if (list.length === 0) {
    return null;
  }

  list.sort((a, b) => {
    const rankDiff = ACCURACY_RANK[b.accuracy] - ACCURACY_RANK[a.accuracy];
    if (rankDiff !== 0) {
      return rankDiff;
    }
    const kindOrder = { weigh_ins: 0, tracked_days: 1 };
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  const winner = list[0]!;
  return { kind: winner.kind, count: winner.count };
}

function isOutsideLowerTolerance(actual: number, goal: number): boolean {
  return actual <= goal * (1 - BALANCE_TOLERANCE);
}

function isOutsideUpperTolerance(actual: number, goal: number): boolean {
  return actual >= goal * (1 + BALANCE_TOLERANCE);
}

/**
 * Protein-rich meal distribution across logged days. Meals below 100 kcal do
 * not count; a day is eligible only when every remaining meal has protein data.
 */
export function computeProteinDistributionStats(
  meals: ProteinDistributionMeal[],
  referenceWeightKg: number | null,
): ProteinDistributionStats | null {
  if (referenceWeightKg == null || !(referenceWeightKg > 0)) {
    return null;
  }

  const thresholdG =
    Math.round(
      (PROTEIN_DISTRIBUTION_G_PER_KG * referenceWeightKg) /
        PROTEIN_DISTRIBUTION_ROUND_TO_G,
    ) * PROTEIN_DISTRIBUTION_ROUND_TO_G;
  const mealsByDay = new Map<string, ProteinDistributionMeal[]>();

  for (const meal of meals) {
    if (!(meal.totalCalories >= PROTEIN_DISTRIBUTION_MIN_MEAL_KCAL)) {
      continue;
    }
    const dayMeals = mealsByDay.get(meal.date) ?? [];
    dayMeals.push(meal);
    mealsByDay.set(meal.date, dayMeals);
  }

  const eligibleDays = [...mealsByDay.values()].filter((dayMeals) =>
    dayMeals.every((meal) => meal.proteinG != null),
  );
  if (eligibleDays.length === 0) {
    return null;
  }

  const totals = eligibleDays.reduce(
    (result, dayMeals) => ({
      mealCount: result.mealCount + dayMeals.length,
      mealsAtThreshold:
        result.mealsAtThreshold +
        dayMeals.filter((meal) => meal.proteinG! >= thresholdG).length,
    }),
    { mealCount: 0, mealsAtThreshold: 0 },
  );

  return {
    thresholdG,
    averageMealsAtThreshold: totals.mealsAtThreshold / eligibleDays.length,
    averageMealCount: totals.mealCount / eligibleDays.length,
    trackedDays: eligibleDays.length,
  };
}

export function computeBalanceStats(
  summary: HistorySummaryStats,
  referenceWeightKg: number | null,
): BalanceStats {
  const proteinHasData =
    summary.proteinAvg != null && summary.proteinGoalAvg != null && summary.proteinGoalAvg > 0;
  const proteinDeltaG = proteinHasData ? summary.proteinAvg! - summary.proteinGoalAvg! : null;
  const proteinOk =
    !proteinHasData || !isOutsideLowerTolerance(summary.proteinAvg!, summary.proteinGoalAvg!);
  const proteinAboveGoal =
    proteinHasData && isOutsideUpperTolerance(summary.proteinAvg!, summary.proteinGoalAvg!);
  const proteinDeviation =
    proteinHasData && !proteinOk ? -proteinDeltaG! / summary.proteinGoalAvg! : null;

  const fiberHasData =
    summary.fiberAvg != null && summary.fiberGoalAvg != null && summary.fiberGoalAvg > 0;
  const fiberDeltaG = fiberHasData ? summary.fiberAvg! - summary.fiberGoalAvg! : null;
  const fiberOk =
    !fiberHasData || !isOutsideLowerTolerance(summary.fiberAvg!, summary.fiberGoalAvg!);
  const fiberDeviation =
    fiberHasData && !fiberOk ? -fiberDeltaG! / summary.fiberGoalAvg! : null;

  const fatHasData = summary.fatAvg != null;
  const fatFloorG =
    referenceWeightKg != null && referenceWeightKg > 0
      ? referenceWeightKg * FAT_G_PER_KG_FLOOR
      : null;
  const fatDeltaG =
    fatHasData && summary.fatGoalAvg != null ? summary.fatAvg! - summary.fatGoalAvg : null;
  const fatBelowFloor =
    fatHasData && fatFloorG != null && isOutsideLowerTolerance(summary.fatAvg!, fatFloorG);
  const fatOverGoal =
    fatHasData &&
    summary.fatGoalAvg != null &&
    summary.fatGoalAvg > 0 &&
    isOutsideUpperTolerance(summary.fatAvg!, summary.fatGoalAvg);
  const fatOk = !fatHasData || (!fatBelowFloor && !fatOverGoal);
  const fatDeviation =
    fatBelowFloor && fatFloorG != null ? (fatFloorG - summary.fatAvg!) / fatFloorG : null;

  const carbsHasData =
    summary.carbsAvg != null && summary.carbsGoalAvg != null && summary.carbsGoalAvg > 0;
  const carbsDeltaG = carbsHasData ? summary.carbsAvg! - summary.carbsGoalAvg! : null;
  const carbsOk =
    !carbsHasData || !isOutsideUpperTolerance(summary.carbsAvg!, summary.carbsGoalAvg!);

  const candidates: Array<{ nutrient: BalanceNutrient; deviation: number }> = [];
  if (proteinDeviation != null) {
    candidates.push({ nutrient: 'protein', deviation: proteinDeviation });
  }
  if (fiberDeviation != null) {
    candidates.push({ nutrient: 'fiber', deviation: fiberDeviation });
  }
  if (fatDeviation != null) {
    candidates.push({ nutrient: 'fat', deviation: fatDeviation });
  }
  candidates.sort((a, b) => b.deviation - a.deviation);

  return {
    proteinOk,
    proteinHasData,
    proteinAboveGoal,
    proteinDeltaG,
    fiberOk,
    fiberHasData,
    fiberDeltaG,
    fatOk,
    fatHasData,
    fatBelowFloor,
    fatOverGoal,
    fatDeltaG,
    carbsHasData,
    carbsOk,
    carbsOverGoal: !carbsOk,
    carbsDeltaG,
    deviatingNutrient: candidates[0]?.nutrient ?? null,
    allOk: proteinOk && fiberOk && fatOk && carbsOk,
  };
}

export type BalanceSummaryHeadline =
  | { kind: 'on_track' }
  | {
      kind: 'small' | 'large';
      nutrient: BalanceSummaryNutrient;
      amountG: number;
      direction: 'under' | 'over';
    };

/** Relative gaps at or below this count as on track. */
const SUMMARY_ON_TRACK_MAX = BALANCE_TOLERANCE;
/** Relative gaps up to this are the soft “round it off” tier. */
const SUMMARY_SMALL_MAX = 0.2;

/**
 * One-sentence headline for the balance card: largest relative gap among
 * protein / fiber / fat / carbs. Never considers calories. Returns null when
 * macro accuracy is too thin to support a claim.
 */
export function computeBalanceSummaryHeadline(params: {
  summary: HistorySummaryStats;
  referenceWeightKg: number | null;
  macroAccuracy: BalanceAccuracy;
}): BalanceSummaryHeadline | null {
  const { summary, referenceWeightKg, macroAccuracy } = params;
  if (macroAccuracy === 'very_rough' || macroAccuracy === 'unavailable') {
    return null;
  }

  type Candidate = {
    nutrient: BalanceSummaryNutrient;
    relative: number;
    amountG: number;
    direction: 'under' | 'over';
  };
  const candidates: Candidate[] = [];

  const pushGap = (
    nutrient: BalanceSummaryNutrient,
    actual: number,
    reference: number,
    direction: 'under' | 'over',
  ) => {
    if (!(reference > 0)) {
      return;
    }
    const amountG = Math.round(Math.abs(actual - reference));
    if (!(amountG > 0)) {
      return;
    }
    candidates.push({
      nutrient,
      relative: amountG / reference,
      amountG,
      direction,
    });
  };

  if (
    summary.proteinAvg != null &&
    summary.proteinGoalAvg != null &&
    summary.proteinGoalAvg > 0
  ) {
    if (isOutsideLowerTolerance(summary.proteinAvg, summary.proteinGoalAvg)) {
      pushGap('protein', summary.proteinAvg, summary.proteinGoalAvg, 'under');
    } else if (isOutsideUpperTolerance(summary.proteinAvg, summary.proteinGoalAvg)) {
      pushGap('protein', summary.proteinAvg, summary.proteinGoalAvg, 'over');
    }
  }

  if (
    summary.fiberAvg != null &&
    summary.fiberGoalAvg != null &&
    summary.fiberGoalAvg > 0 &&
    isOutsideLowerTolerance(summary.fiberAvg, summary.fiberGoalAvg)
  ) {
    pushGap('fiber', summary.fiberAvg, summary.fiberGoalAvg, 'under');
  }

  const fatFloorG =
    referenceWeightKg != null && referenceWeightKg > 0
      ? referenceWeightKg * FAT_G_PER_KG_FLOOR
      : null;
  if (summary.fatAvg != null && fatFloorG != null && isOutsideLowerTolerance(summary.fatAvg, fatFloorG)) {
    pushGap('fat', summary.fatAvg, fatFloorG, 'under');
  } else if (
    summary.fatAvg != null &&
    summary.fatGoalAvg != null &&
    summary.fatGoalAvg > 0 &&
    isOutsideUpperTolerance(summary.fatAvg, summary.fatGoalAvg)
  ) {
    pushGap('fat', summary.fatAvg, summary.fatGoalAvg, 'over');
  }

  if (
    summary.carbsAvg != null &&
    summary.carbsGoalAvg != null &&
    summary.carbsGoalAvg > 0 &&
    isOutsideUpperTolerance(summary.carbsAvg, summary.carbsGoalAvg)
  ) {
    pushGap('carbs', summary.carbsAvg, summary.carbsGoalAvg, 'over');
  }

  if (candidates.length === 0) {
    return { kind: 'on_track' };
  }

  candidates.sort((a, b) => b.relative - a.relative);
  const top = candidates[0]!;
  if (top.relative <= SUMMARY_ON_TRACK_MAX) {
    return { kind: 'on_track' };
  }
  if (top.relative <= SUMMARY_SMALL_MAX) {
    return {
      kind: 'small',
      nutrient: top.nutrient,
      amountG: top.amountG,
      direction: top.direction,
    };
  }
  return {
    kind: 'large',
    nutrient: top.nutrient,
    amountG: top.amountG,
    direction: top.direction,
  };
}

/** Last 7 closed calendar days; today is still in progress. */
export const CALORIE_UNDERSHOOT_LOOKBACK_DAYS = 7;
/** Deficit must be strictly more than this fraction of that day's goal. */
export const CALORIE_UNDERSHOOT_RATIO = 0.25;
export const CALORIE_UNDERSHOOT_MIN_DAYS = 3;

export type CalorieUndershootDay = {
  date: string;
  hasMeals: boolean;
  totalCalories: number;
  calorieGoal: number | null;
};

/**
 * Pattern, not a single day: ≥3 of the last 7 *completed, fully logged* days
 * are more than 25 % under that day's calorie goal.
 *
 * Untracked days are not treated as zero — they would look like a huge deficit.
 * If any of the seven closed days is missing meals or a goal, returns false.
 */
export function detectRepeatedCalorieUndershoot(params: {
  days: readonly CalorieUndershootDay[];
  todayKey: string;
}): boolean {
  const closed = params.days
    .filter((day) => day.date < params.todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const window = closed.slice(-CALORIE_UNDERSHOOT_LOOKBACK_DAYS);
  if (window.length < CALORIE_UNDERSHOOT_LOOKBACK_DAYS) {
    return false;
  }

  const complete = window.every(
    (day) => day.hasMeals && day.calorieGoal != null && day.calorieGoal > 0,
  );
  if (!complete) {
    return false;
  }

  const underCount = window.filter((day) => {
    const goal = day.calorieGoal!;
    return day.totalCalories < goal * (1 - CALORIE_UNDERSHOOT_RATIO);
  }).length;

  return underCount >= CALORIE_UNDERSHOOT_MIN_DAYS;
}
