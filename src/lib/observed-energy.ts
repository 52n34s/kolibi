/**
 * Adaptive / observed daily expenditure from energy balance:
 *   expenditure ≈ mean(eligible intake) − (Δweight_kg × 7700 / span_days)
 *
 * Pure math only — no I/O. Window is 28 closed local days (excludes today).
 */

import {
  trailingMovingAverage,
  WEIGHT_ETA_MA_WINDOW_DAYS,
} from './weight-goal-eta';

/** Matches calorie-goal-math.KCAL_PER_KG_BODY_WEIGHT (inlined for Node strip-types tests). */
const KCAL_PER_KG_BODY_WEIGHT = 7700;

export const OBSERVED_WINDOW_DAYS = 28;
export const OBSERVED_MIN_MEALS_OVER_100 = 2;
export const OBSERVED_MEAL_KCAL_FLOOR = 100;
export const OBSERVED_MEDIAN_FRACTION = 0.6;
export const OBSERVED_MIN_WEIGH_DAYS = 4;
export const OBSERVED_MIN_WEIGHT_SPAN_DAYS = 14;
/** Ready: suggestion allowed. */
export const OBSERVED_READY_MIN_ELIGIBLE_DAYS = 21;
/** Rough: show value, no suggestion. Below this → insufficient. */
export const OBSERVED_ROUGH_MIN_ELIGIBLE_DAYS = 18;
/**
 * Upper reject bound against the BMR×activity TDEE. The lower bound is the BMR
 * itself: a measured expenditure below resting metabolism is not physiology,
 * it is a gap in the intake or weight data.
 */
export const OBSERVED_PLAUSIBILITY_HIGH = 1.75;
/** Minimum |observed − current maintenance| to offer a target update. */
export const OBSERVED_SUGGESTION_MIN_DELTA_KCAL = 100;

export type ObservedEnergyStatus = 'insufficient' | 'rough' | 'ready';

export type ObservedMealInput = {
  /** Local YYYY-MM-DD */
  dateKey: string;
  totalKcal: number;
  /**
   * Absolute protein for the meal. When kcal > 0 and protein is 0/null, the
   * day is treated as a legacy macro gap and cannot be eligible for observed
   * energy (same rule as history macroOrEmpty).
   */
  proteinG?: number | null;
};

export type ObservedWeightInput = {
  weightKg: number;
  loggedAt: string | Date;
};

export type ObservedEnergyInput = {
  meals: ObservedMealInput[];
  weights: ObservedWeightInput[];
  /** BMR × activity-factor (or equivalent) maintenance — upper plausibility bound. */
  estimatedMaintenanceKcal: number;
  /** Resting metabolism — lower plausibility bound. */
  bmrKcal: number;
  /** Anchor day; window is the 28 local days before this (today excluded). */
  today?: Date;
};

export type ObservedEnergyResult =
  | {
      status: 'insufficient';
      eligibleDays: number;
      reason:
        | 'eligible_days'
        | 'weigh_days'
        | 'weight_span'
        | 'plausibility'
        | 'no_intake';
    }
  | {
      status: 'rough' | 'ready';
      eligibleDays: number;
      observedKcal: number;
      meanIntakeKcal: number;
      weightDeltaKg: number;
      weightSpanDays: number;
    };

type DayIntake = {
  dateKey: string;
  totalKcal: number;
  mealsOver100: number;
  /** False when any meal looks like a legacy protein_g=0 gap. */
  macrosComplete: boolean;
};

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Closed 28-day window ending yesterday (today excluded), oldest → newest. */
export function buildObservedWindowDateKeys(today: Date = new Date()): string[] {
  const end = startOfLocalDay(today);
  end.setDate(end.getDate() - 1);
  const keys: string[] = [];
  for (let offset = OBSERVED_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - offset);
    keys.push(localDateKey(d));
  }
  return keys;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mealMacrosComplete(meal: ObservedMealInput): boolean {
  const kcal = Number.isFinite(meal.totalKcal) ? Math.max(0, meal.totalKcal) : 0;
  if (!(kcal > 0)) {
    return true;
  }
  // Omitted protein (unit tests / calorie-only callers) → assume complete.
  if (meal.proteinG === undefined) {
    return true;
  }
  // Explicit null or legacy coalesced 0 with positive kcal → gap.
  if (meal.proteinG == null || meal.proteinG === 0) {
    return false;
  }
  return true;
}

function buildDayIntakes(
  dateKeys: string[],
  meals: ObservedMealInput[],
): DayIntake[] {
  const byDay = new Map<string, DayIntake>();
  for (const key of dateKeys) {
    byDay.set(key, {
      dateKey: key,
      totalKcal: 0,
      mealsOver100: 0,
      macrosComplete: true,
    });
  }

  for (const meal of meals) {
    const day = byDay.get(meal.dateKey);
    if (day == null) {
      continue;
    }
    const kcal = Number.isFinite(meal.totalKcal) ? Math.max(0, meal.totalKcal) : 0;
    day.totalKcal += kcal;
    if (kcal > OBSERVED_MEAL_KCAL_FLOOR) {
      day.mealsOver100 += 1;
    }
    if (!mealMacrosComplete(meal)) {
      day.macrosComplete = false;
    }
  }

  return dateKeys.map((key) => byDay.get(key)!);
}

function selectEligibleDays(days: DayIntake[]): DayIntake[] {
  const loggedTotals = days
    .filter((d) => d.totalKcal > 0 && d.macrosComplete)
    .map((d) => d.totalKcal);
  const med = median(loggedTotals);
  if (med == null || !(med > 0)) {
    return [];
  }
  const floor = med * OBSERVED_MEDIAN_FRACTION;
  return days.filter(
    (d) =>
      d.macrosComplete &&
      d.mealsOver100 >= OBSERVED_MIN_MEALS_OVER_100 &&
      d.totalKcal >= floor,
  );
}

type TrendPoint = { day: number; weightKg: number; at: Date };

function weightPointsInWindow(
  weights: ObservedWeightInput[],
  windowStart: Date,
  windowEnd: Date,
): TrendPoint[] {
  // Include MA lookback before the window so early endpoints can smooth.
  const lookbackStart = new Date(windowStart);
  lookbackStart.setDate(lookbackStart.getDate() - (WEIGHT_ETA_MA_WINDOW_DAYS - 1));

  const byDay = new Map<number, TrendPoint>();
  const msPerDay = 24 * 60 * 60 * 1000;

  for (const log of weights) {
    if (!Number.isFinite(log.weightKg) || !(log.weightKg > 0)) {
      continue;
    }
    const at = startOfLocalDay(toDate(log.loggedAt));
    if (at.getTime() < lookbackStart.getTime() || at.getTime() > windowEnd.getTime()) {
      continue;
    }
    const day = Math.round(at.getTime() / msPerDay);
    const existing = byDay.get(day);
    if (existing == null || at.getTime() >= existing.at.getTime()) {
      byDay.set(day, { day, weightKg: log.weightKg, at });
    }
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

function countWeighDaysInWindow(
  points: TrendPoint[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  return points.filter((p) => {
    const t = p.at.getTime();
    return t >= startMs && t <= endMs;
  }).length;
}

/**
 * Derive observed daily expenditure. Returns insufficient when the sample
 * is too thin or fails the BMR-based plausibility band.
 */
export function computeObservedEnergy(input: ObservedEnergyInput): ObservedEnergyResult {
  const today = startOfLocalDay(input.today ?? new Date());
  const dateKeys = buildObservedWindowDateKeys(today);
  const windowStart = parseDateOnly(dateKeys[0]!);
  const windowEnd = parseDateOnly(dateKeys[dateKeys.length - 1]!);
  windowStart.setHours(0, 0, 0, 0);
  windowEnd.setHours(0, 0, 0, 0);

  const dayIntakes = buildDayIntakes(dateKeys, input.meals);
  const eligible = selectEligibleDays(dayIntakes);
  const eligibleDays = eligible.length;

  if (eligibleDays === 0) {
    return { status: 'insufficient', eligibleDays: 0, reason: 'no_intake' };
  }
  if (eligibleDays < OBSERVED_ROUGH_MIN_ELIGIBLE_DAYS) {
    return { status: 'insufficient', eligibleDays, reason: 'eligible_days' };
  }

  const meanIntakeKcal =
    eligible.reduce((sum, d) => sum + d.totalKcal, 0) / eligibleDays;

  const rawPoints = weightPointsInWindow(input.weights, windowStart, windowEnd);
  const weighDays = countWeighDaysInWindow(rawPoints, windowStart, windowEnd);
  if (weighDays < OBSERVED_MIN_WEIGH_DAYS) {
    return { status: 'insufficient', eligibleDays, reason: 'weigh_days' };
  }

  const smoothed = trailingMovingAverage(rawPoints);
  const inWindow = smoothed.filter((p) => {
    const t = p.at.getTime();
    return t >= windowStart.getTime() && t <= windowEnd.getTime();
  });
  if (inWindow.length < 2) {
    return { status: 'insufficient', eligibleDays, reason: 'weight_span' };
  }

  const first = inWindow[0]!;
  const last = inWindow[inWindow.length - 1]!;
  const weightSpanDays = Math.round(last.day - first.day);
  if (weightSpanDays < OBSERVED_MIN_WEIGHT_SPAN_DAYS) {
    return { status: 'insufficient', eligibleDays, reason: 'weight_span' };
  }

  const weightDeltaKg = last.weightKg - first.weightKg;
  const observedRaw =
    meanIntakeKcal - (weightDeltaKg * KCAL_PER_KG_BODY_WEIGHT) / weightSpanDays;
  const observedKcal = Math.round(observedRaw);

  const estimate = input.estimatedMaintenanceKcal;
  const bmr = input.bmrKcal;
  if (
    !(estimate > 0) ||
    !(bmr > 0) ||
    observedKcal < bmr ||
    observedKcal > estimate * OBSERVED_PLAUSIBILITY_HIGH
  ) {
    return { status: 'insufficient', eligibleDays, reason: 'plausibility' };
  }

  const status: 'rough' | 'ready' =
    eligibleDays >= OBSERVED_READY_MIN_ELIGIBLE_DAYS ? 'ready' : 'rough';

  return {
    status,
    eligibleDays,
    observedKcal,
    meanIntakeKcal: Math.round(meanIntakeKcal),
    weightDeltaKg: Math.round(weightDeltaKg * 10) / 10,
    weightSpanDays,
  };
}

/** Whether the history prompt may offer updating the calorie target. */
export function shouldOfferObservedGoalUpdate(params: {
  status: ObservedEnergyStatus;
  observedKcal: number;
  currentMaintenanceKcal: number;
  calorieGoalSource: string | null | undefined;
  dismissedUntil: string | null | undefined;
  today?: Date;
}): boolean {
  if (params.status !== 'ready') {
    return false;
  }
  if (params.calorieGoalSource === 'custom') {
    return false;
  }
  if (
    Math.abs(params.observedKcal - params.currentMaintenanceKcal) <
    OBSERVED_SUGGESTION_MIN_DELTA_KCAL
  ) {
    return false;
  }

  if (params.dismissedUntil) {
    const todayKey = localDateKey(params.today ?? new Date());
    if (params.dismissedUntil > todayKey) {
      return false;
    }
  }

  return true;
}

/** Local date key seven days after `today` (exclusive end of suppress window). */
export function observedPromptDismissedUntil(today: Date = new Date()): string {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 7);
  return localDateKey(d);
}
