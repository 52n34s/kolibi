import { trailingMovingAverage } from './weight-goal-eta';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Same floor as `trailingMovingAverage` — a 7-day window needs 3 weigh days. */
const DISPLAY_WEIGHT_MA_MIN_SAMPLES = 3;

export type DisplayWeightLog = {
  weight_kg: number;
  logged_at: string;
};

export type DisplayWeight = {
  /** Last weigh-in on or before today. */
  dailyKg: number | null;
  /**
   * Trailing 7-day MA at that last weigh-in, or `dailyKg` when the window
   * has fewer than 3 samples. Theil-Sen is not used here.
   */
  trendKg: number | null;
  /** MA at the first weigh-in on or after `startOn`, or null (no raw fallback). */
  startTrendKg: number | null;
  /** Raw first weigh-in on or after `startOn`. */
  startRawKg: number | null;
  /**
   * Bar endpoints: both MA when both ends have one, otherwise both raw.
   * Never mixed — a raw bar is better than a false one.
   */
  barStartKg: number | null;
  barEndKg: number | null;
  barUsesMa: boolean;
};

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnly(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function dayNumberFromKey(key: string): number {
  return Math.round(startOfLocalDay(parseDateOnly(key)).getTime() / MS_PER_DAY);
}

type Point = { day: number; weightKg: number; at: Date };

function dailyPoints(logs: readonly DisplayWeightLog[], todayDay: number): Point[] {
  const byDay = new Map<number, Point>();
  for (const entry of logs) {
    const at = startOfLocalDay(new Date(entry.logged_at));
    const day = Math.round(at.getTime() / MS_PER_DAY);
    if (day > todayDay) {
      continue;
    }
    if (!Number.isFinite(entry.weight_kg) || entry.weight_kg <= 0) {
      continue;
    }
    const existing = byDay.get(day);
    if (existing == null || at.getTime() >= existing.at.getTime()) {
      byDay.set(day, { day, weightKg: entry.weight_kg, at });
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/**
 * Display weight for Home and Progress. Internals: trailing MA only.
 * Lookback before `startOn` must be in `logs` if the start should have an MA;
 * the first log with no earlier samples never does.
 */
export function resolveDisplayWeight(params: {
  logs: readonly DisplayWeightLog[];
  startOn: string;
  today: string;
}): DisplayWeight {
  const empty: DisplayWeight = {
    dailyKg: null,
    trendKg: null,
    startTrendKg: null,
    startRawKg: null,
    barStartKg: null,
    barEndKg: null,
    barUsesMa: false,
  };

  const todayDay = dayNumberFromKey(params.today);
  const startDay = dayNumberFromKey(params.startOn);
  const daily = dailyPoints(params.logs, todayDay);
  if (daily.length === 0) {
    return empty;
  }

  const averaged = trailingMovingAverage(daily, DISPLAY_WEIGHT_MA_MIN_SAMPLES);
  const maByDay = new Map(averaged.map((point) => [point.day, point.weightKg]));

  const endPoint = daily[daily.length - 1]!;
  const dailyKg = endPoint.weightKg;
  const endMa = maByDay.get(endPoint.day) ?? null;
  const trendKg = endMa ?? dailyKg;

  const startPoint = daily.find((point) => point.day >= startDay) ?? null;
  const startRawKg = startPoint?.weightKg ?? null;
  const startTrendKg =
    startPoint != null ? (maByDay.get(startPoint.day) ?? null) : null;

  if (startTrendKg != null && endMa != null) {
    return {
      dailyKg,
      trendKg,
      startTrendKg,
      startRawKg,
      barStartKg: startTrendKg,
      barEndKg: endMa,
      barUsesMa: true,
    };
  }

  return {
    dailyKg,
    trendKg,
    startTrendKg,
    startRawKg,
    barStartKg: startRawKg,
    barEndKg: dailyKg,
    barUsesMa: false,
  };
}
