/**
 * Weight-goal ETA: trend-based when ≥14 days of logs exist, otherwise theoretical
 * (7700 kcal ≈ 1 kg). Dates are always fuzzy — never day-precise.
 */

/** Matches calorie-goal-math.KCAL_PER_KG_BODY_WEIGHT (inlined for Node strip-types tests). */
const KCAL_PER_KG_BODY_WEIGHT = 7700;

export const WEIGHT_ETA_MIN_TREND_SPAN_DAYS = 14;
export const WEIGHT_ETA_TREND_LOOKBACK_DAYS = 28;
export const WEIGHT_ETA_MA_WINDOW_DAYS = 7;
export const WEIGHT_ETA_MAX_MONTHS = 18;
/** ~547 days — 18 × 30.4 */
export const WEIGHT_ETA_MAX_DAYS = Math.round(WEIGHT_ETA_MAX_MONTHS * 30.4375);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type WeightGoalDirection = 'loss' | 'gain' | 'none';

export type WeightEtaLog = {
  weightKg: number;
  /** ISO timestamp or Date */
  loggedAt: string | Date;
};

export type WeightGoalEtaInput = {
  logs: WeightEtaLog[];
  targetWeightKg: number;
  /** Used when trend span is too short, and for deficit≤0 checks. */
  currentWeightKg?: number | null;
  dailyCalorieGoal?: number | null;
  maintenanceCalories?: number | null;
  goalDirection: WeightGoalDirection;
  today?: Date;
};

export type WeightGoalEtaOk = {
  status: 'ok';
  etaDate: Date;
  daysRemaining: number;
  method: 'trend' | 'theoretical';
};

export type WeightGoalEtaResult =
  | WeightGoalEtaOk
  | { status: 'over_year'; method: 'trend' | 'theoretical' }
  | { status: 'not_losing' }
  | { status: 'not_gaining' }
  | { status: 'unavailable' };

export type FuzzyMonthPart = 'early' | 'mid' | 'late';

export function resolveGoalDirectionFromGoalType(
  goalType: string | null | undefined,
): WeightGoalDirection {
  switch (goalType) {
    case 'lose_weight':
    case 'faster_weight_loss':
    case 'ABNEHMEN':
      return 'loss';
    case 'gain_weight':
    case 'MUSKELAUFBAU':
      return 'gain';
    default:
      return 'none';
  }
}

/** Infer direction from calorie goal vs maintenance when goal type is custom/unknown. */
export function resolveGoalDirectionFromCalories(params: {
  goalType?: string | null;
  dailyCalorieGoal: number;
  maintenanceCalories: number;
}): WeightGoalDirection {
  const fromType = resolveGoalDirectionFromGoalType(params.goalType);
  if (fromType !== 'none') {
    return fromType;
  }
  const delta = params.maintenanceCalories - params.dailyCalorieGoal;
  if (delta > 25) {
    return 'loss';
  }
  if (delta < -25) {
    return 'gain';
  }
  return 'none';
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return (startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / MS_PER_DAY;
}

type Point = { day: number; weightKg: number; at: Date };

function normalizeLogs(logs: WeightEtaLog[], today: Date): Point[] {
  const lookbackStart = startOfLocalDay(today);
  lookbackStart.setDate(lookbackStart.getDate() - WEIGHT_ETA_TREND_LOOKBACK_DAYS);

  const byDay = new Map<number, Point>();
  for (const log of logs) {
    const at = startOfLocalDay(toDate(log.loggedAt));
    if (at.getTime() < lookbackStart.getTime()) {
      continue;
    }
    if (!Number.isFinite(log.weightKg) || log.weightKg <= 0) {
      continue;
    }
    const day = Math.round(at.getTime() / MS_PER_DAY);
    // One point per calendar day — keep the chronologically last sample.
    const existing = byDay.get(day);
    if (existing == null || at.getTime() >= existing.at.getTime()) {
      byDay.set(day, { day, weightKg: log.weightKg, at });
    }
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/**
 * Trailing moving average over WEIGHT_ETA_MA_WINDOW_DAYS.
 * Points need at least `minSamples` logs inside the window so early
 * single-day anchors don't dominate the trend endpoints.
 */
export function trailingMovingAverage(
  points: Point[],
  minSamples = 3,
): Point[] {
  if (points.length === 0) {
    return [];
  }

  const result: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const anchor = points[i]!;
    const windowStartDay = anchor.day - (WEIGHT_ETA_MA_WINDOW_DAYS - 1);
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j -= 1) {
      const p = points[j]!;
      if (p.day < windowStartDay) {
        break;
      }
      sum += p.weightKg;
      count += 1;
    }
    if (count < minSamples) {
      continue;
    }
    result.push({
      day: anchor.day,
      weightKg: sum / count,
      at: anchor.at,
    });
  }
  return result;
}

/** Ordinary least-squares slope (kg / day) for points with distinct days. */
export function linearSlopeKgPerDay(points: Point[]): number | null {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.day;
    sumY += p.weightKg;
    sumXY += p.day * p.weightKg;
    sumXX += p.day * p.day;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    return null;
  }
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Theil–Sen slope (median of pairwise slopes) — robust to a single noisy day.
 */
export function theilSenSlopeKgPerDay(points: Point[]): number | null {
  if (points.length < 2) {
    return null;
  }
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j]!.day - points[i]!.day;
      if (dx === 0) {
        continue;
      }
      slopes.push((points[j]!.weightKg - points[i]!.weightKg) / dx);
    }
  }
  if (slopes.length === 0) {
    return null;
  }
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  if (slopes.length % 2 === 1) {
    return slopes[mid]!;
  }
  return (slopes[mid - 1]! + slopes[mid]!) / 2;
}

/**
 * Actual weekly change from the same trailing-7-day-MA / Theil–Sen trend used
 * for the weight-goal ETA. Positive values indicate gain, negative loss.
 */
export function computeWeeklyTrendWeightChangePercent(
  logs: WeightEtaLog[],
  today: Date = new Date(),
): { weeklyChangePercent: number; currentWeightKg: number } | null {
  const points = normalizeLogs(logs, startOfLocalDay(today));
  const smoothed = trailingMovingAverage(points);
  const slopeKgPerDay = theilSenSlopeKgPerDay(smoothed);
  const currentWeightKg = smoothed[smoothed.length - 1]?.weightKg ?? null;

  if (
    slopeKgPerDay == null ||
    currentWeightKg == null ||
    !(currentWeightKg > 0) ||
    !Number.isFinite(slopeKgPerDay)
  ) {
    return null;
  }

  return {
    weeklyChangePercent: (slopeKgPerDay * 7 * 100) / currentWeightKg,
    currentWeightKg,
  };
}

function spanDays(points: Point[]): number {
  if (points.length < 2) {
    return 0;
  }
  return points[points.length - 1]!.day - points[0]!.day;
}

function buildOkResult(
  daysRemaining: number,
  method: 'trend' | 'theoretical',
  today: Date,
): WeightGoalEtaResult {
  if (!(daysRemaining > 0) || !Number.isFinite(daysRemaining)) {
    return { status: 'unavailable' };
  }
  if (daysRemaining > WEIGHT_ETA_MAX_DAYS) {
    return { status: 'over_year', method };
  }
  const etaDate = startOfLocalDay(today);
  etaDate.setDate(etaDate.getDate() + Math.round(daysRemaining));
  return {
    status: 'ok',
    etaDate,
    daysRemaining: Math.round(daysRemaining),
    method,
  };
}

function theoreticalEta(params: {
  currentWeightKg: number;
  targetWeightKg: number;
  dailyCalorieGoal: number;
  maintenanceCalories: number;
  goalDirection: WeightGoalDirection;
  today: Date;
}): WeightGoalEtaResult {
  const { currentWeightKg, targetWeightKg, dailyCalorieGoal, maintenanceCalories, goalDirection, today } =
    params;

  if (!(currentWeightKg > 0) || !(targetWeightKg > 0)) {
    return { status: 'unavailable' };
  }

  const deficit = maintenanceCalories - dailyCalorieGoal; // >0 means caloric deficit
  const deltaKg = currentWeightKg - targetWeightKg; // >0 means need to lose

  if (goalDirection === 'loss') {
    if (deficit <= 0) {
      return { status: 'not_losing' };
    }
    if (deltaKg <= 0.05) {
      return { status: 'unavailable' };
    }
    const days = (deltaKg * KCAL_PER_KG_BODY_WEIGHT) / deficit;
    return buildOkResult(days, 'theoretical', today);
  }

  if (goalDirection === 'gain') {
    const surplus = -deficit;
    if (surplus <= 0) {
      return { status: 'not_gaining' };
    }
    if (-deltaKg <= 0.05) {
      return { status: 'unavailable' };
    }
    const days = ((targetWeightKg - currentWeightKg) * KCAL_PER_KG_BODY_WEIGHT) / surplus;
    return buildOkResult(days, 'theoretical', today);
  }

  return { status: 'unavailable' };
}

function trendEta(params: {
  smoothed: Point[];
  targetWeightKg: number;
  goalDirection: WeightGoalDirection;
  today: Date;
  /** Still surface not_losing when theory says deficit ≤ 0 even if trend exists. */
  dailyCalorieGoal?: number | null;
  maintenanceCalories?: number | null;
}): WeightGoalEtaResult {
  const {
    smoothed,
    targetWeightKg,
    goalDirection,
    today,
    dailyCalorieGoal,
    maintenanceCalories,
  } = params;

  if (
    goalDirection === 'loss' &&
    dailyCalorieGoal != null &&
    maintenanceCalories != null &&
    maintenanceCalories - dailyCalorieGoal <= 0
  ) {
    return { status: 'not_losing' };
  }
  if (
    goalDirection === 'gain' &&
    dailyCalorieGoal != null &&
    maintenanceCalories != null &&
    dailyCalorieGoal - maintenanceCalories <= 0
  ) {
    return { status: 'not_gaining' };
  }

  const slope = theilSenSlopeKgPerDay(smoothed);
  if (slope == null || Math.abs(slope) < 1e-6) {
    return { status: 'unavailable' };
  }

  const current = smoothed[smoothed.length - 1]!.weightKg;
  const remaining = targetWeightKg - current; // negative when losing toward lower target

  if (goalDirection === 'loss') {
    if (remaining >= -0.05) {
      return { status: 'unavailable' };
    }
    // Need negative slope (losing).
    if (slope >= 0) {
      return { status: 'unavailable' };
    }
    const days = remaining / slope; // both negative → positive
    return buildOkResult(days, 'trend', today);
  }

  if (goalDirection === 'gain') {
    if (remaining <= 0.05) {
      return { status: 'unavailable' };
    }
    if (slope <= 0) {
      return { status: 'unavailable' };
    }
    const days = remaining / slope;
    return buildOkResult(days, 'trend', today);
  }

  return { status: 'unavailable' };
}

/**
 * Prefer smoothed 2–4 week trend; fall back to theoretical kcal math when the
 * log span is under 14 days.
 */
export function computeWeightGoalEta(input: WeightGoalEtaInput): WeightGoalEtaResult {
  const today = startOfLocalDay(input.today ?? new Date());
  const { targetWeightKg, goalDirection } = input;

  if (!(targetWeightKg > 0) || goalDirection === 'none') {
    return { status: 'unavailable' };
  }

  const points = normalizeLogs(input.logs, today);
  const smoothed = trailingMovingAverage(points);
  const span = spanDays(smoothed.length >= 2 ? smoothed : points);

  if (span >= WEIGHT_ETA_MIN_TREND_SPAN_DAYS && smoothed.length >= 2) {
    return trendEta({
      smoothed,
      targetWeightKg,
      goalDirection,
      today,
      dailyCalorieGoal: input.dailyCalorieGoal,
      maintenanceCalories: input.maintenanceCalories,
    });
  }

  const currentWeightKg =
    input.currentWeightKg ??
    (points.length > 0 ? points[points.length - 1]!.weightKg : null);

  if (
    currentWeightKg == null ||
    input.dailyCalorieGoal == null ||
    input.maintenanceCalories == null ||
    !(input.dailyCalorieGoal > 0) ||
    !(input.maintenanceCalories > 0)
  ) {
    return { status: 'unavailable' };
  }

  return theoreticalEta({
    currentWeightKg,
    targetWeightKg,
    dailyCalorieGoal: input.dailyCalorieGoal,
    maintenanceCalories: input.maintenanceCalories,
    goalDirection,
    today,
  });
}

export function fuzzyMonthPart(date: Date): FuzzyMonthPart {
  const day = date.getDate();
  if (day <= 10) {
    return 'early';
  }
  if (day <= 20) {
    return 'mid';
  }
  return 'late';
}

export function localizedMonthName(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'long' });
}

/**
 * Pure parts for i18n: "etwa Ende Februar 2027".
 * Caller composes with t('weightGoalEta.fuzzy', { part, month, year }).
 */
export function fuzzyEtaParts(date: Date): {
  part: FuzzyMonthPart;
  monthDate: Date;
  year: number;
} {
  return {
    part: fuzzyMonthPart(date),
    monthDate: date,
    year: date.getFullYear(),
  };
}
