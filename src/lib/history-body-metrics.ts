export type HistoryBodyMetric = 'weight' | 'waist' | 'bodyFat';

type DatedLog = {
  logged_at: string;
  logged_on?: string;
};

type WeightLog = DatedLog & { weight_kg: number };
type WaistLog = DatedLog & { waist_cm: number };
type BodyFatLog = DatedLog & { body_fat_pct: number };

/**
 * All three tabs show as soon as the body card renders. Gating them on existing
 * logs made the "not tracked yet" state unreachable — the very state that asks
 * for the first entry.
 */
export const BODY_METRIC_TABS: readonly HistoryBodyMetric[] = [
  'weight',
  'waist',
  'bodyFat',
];

/** Waist is typically weekly; a 7-day window is one point. Always chart 30 days. */
export const WAIST_CHART_RANGE_DAYS = 30;

/** Last ~4 weeks for the weight-vs-waist sentence. */
export const WEIGHT_WAIST_COMPARISON_WINDOW_DAYS = 28;

/** Both series need this span so "since N weeks" is meaningful. */
export const WEIGHT_WAIST_COMPARISON_MIN_SPAN_DAYS = 21;

export const WEIGHT_WAIST_COMPARISON_MIN_POINTS = 2;

/** Scale noise / day-to-day water; below this, weight is "unchanged". */
export const WEIGHT_UNCHANGED_KG = 0.3;

/** Waist deltas below this are treated as unchanged. */
export const WAIST_UNCHANGED_CM = 0.5;

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateOnly(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function rangeWindowKeys(params: {
  rangeDays: number;
  todayKey?: string;
}): { startKey: string; endKey: string } {
  const endKey = params.todayKey ?? localDateKey();
  const start = parseDateOnly(endKey);
  start.setDate(start.getDate() - (params.rangeDays - 1));
  return { startKey: localDateKey(start), endKey };
}

/** Chart window for waist: never 7 days. */
export function waistChartRangeDays(globalRangeDays: number): number {
  return Math.max(globalRangeDays, WAIST_CHART_RANGE_DAYS);
}

export function shouldShowWaistRangeBadge(globalRangeDays: number): boolean {
  return globalRangeDays < WAIST_CHART_RANGE_DAYS;
}

export type WeightWaistComparison = {
  spanWeeks: number;
  weightUnchanged: boolean;
  weightDeltaKg: number;
  waistDeltaCm: number;
};

function logDayKey(entry: DatedLog): string {
  return entry.logged_on ?? localDateKey(new Date(entry.logged_at));
}

function filterByWindow<T extends DatedLog>(
  logs: T[],
  startKey: string,
  endKey: string,
): T[] {
  return logs.filter((log) => {
    const key = logDayKey(log);
    return key >= startKey && key <= endKey;
  });
}

function spanDaysBetween(startKey: string, endKey: string): number {
  const start = parseDateOnly(startKey);
  const end = parseDateOnly(endKey);
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

/**
 * Sentence input for weight vs waist — not a second chart series.
 * Needs ≥2 points in each series over a ~4-week window spanning ≥3 weeks,
 * and at least one of the two actually moved.
 */
export function computeWeightWaistComparison(params: {
  weightLogs: WeightLog[];
  waistLogs: WaistLog[];
  todayKey?: string;
}): WeightWaistComparison | null {
  const { startKey, endKey } = rangeWindowKeys({
    rangeDays: WEIGHT_WAIST_COMPARISON_WINDOW_DAYS,
    todayKey: params.todayKey,
  });
  const weights = filterByWindow(params.weightLogs, startKey, endKey);
  const waists = filterByWindow(params.waistLogs, startKey, endKey);
  if (
    weights.length < WEIGHT_WAIST_COMPARISON_MIN_POINTS ||
    waists.length < WEIGHT_WAIST_COMPARISON_MIN_POINTS
  ) {
    return null;
  }

  const firstWeight = weights[0]!;
  const lastWeight = weights[weights.length - 1]!;
  const firstWaist = waists[0]!;
  const lastWaist = waists[waists.length - 1]!;
  const firstKey = [logDayKey(firstWeight), logDayKey(firstWaist)].sort()[0]!;
  const lastKey = [logDayKey(lastWeight), logDayKey(lastWaist)].sort()[1]!;
  const spanDays = spanDaysBetween(firstKey, lastKey);
  if (spanDays < WEIGHT_WAIST_COMPARISON_MIN_SPAN_DAYS) {
    return null;
  }

  const weightDeltaKg =
    Math.round((lastWeight.weight_kg - firstWeight.weight_kg) * 10) / 10;
  const waistDeltaCm =
    Math.round((lastWaist.waist_cm - firstWaist.waist_cm) * 10) / 10;
  const weightUnchanged = Math.abs(weightDeltaKg) < WEIGHT_UNCHANGED_KG;
  const waistUnchanged = Math.abs(waistDeltaCm) < WAIST_UNCHANGED_CM;
  if (weightUnchanged && waistUnchanged) {
    return null;
  }

  return {
    spanWeeks: Math.max(1, Math.round(spanDays / 7)),
    weightUnchanged,
    weightDeltaKg,
    waistDeltaCm,
  };
}

export function getLatestBodyFatPct(logs: BodyFatLog[]): number | null {
  if (logs.length === 0) {
    return null;
  }
  return logs[logs.length - 1]?.body_fat_pct ?? null;
}
