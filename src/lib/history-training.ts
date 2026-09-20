export type HistoryTrainingEmptyKind = 'connect_health' | 'set_movement_goal';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateOnly(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function mondayOnOrBefore(dateKey: string): string {
  const date = parseDateOnly(dateKey);
  const weekday = date.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return localDateKey(date);
}

/** Inclusive local calendar keys from start to end. */
export function inclusiveDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const cursor = parseDateOnly(startKey);
  const end = parseDateOnly(endKey);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function loggedOnInRange(
  loggedOn: string,
  startKey: string,
  endKey: string,
): boolean {
  return loggedOn >= startKey && loggedOn <= endKey;
}

/**
 * Distinct training days per Monday-start week overlapping the range.
 * Empty weeks stay in the series so a 30-day chart is not a single bar.
 */
export function weeklyDistinctTrainingDayCounts(params: {
  loggedOnKeys: readonly string[];
  startKey: string;
  endKey: string;
}): Array<{ weekStart: string; count: number }> {
  const firstMonday = mondayOnOrBefore(params.startKey);
  const lastMonday = mondayOnOrBefore(params.endKey);
  const daysByWeek = new Map<string, Set<string>>();

  const cursor = parseDateOnly(firstMonday);
  const last = parseDateOnly(lastMonday);
  while (cursor.getTime() <= last.getTime()) {
    daysByWeek.set(localDateKey(cursor), new Set());
    cursor.setDate(cursor.getDate() + 7);
  }

  for (const loggedOn of params.loggedOnKeys) {
    if (!loggedOnInRange(loggedOn, params.startKey, params.endKey)) {
      continue;
    }
    const weekStart = mondayOnOrBefore(loggedOn);
    const bucket = daysByWeek.get(weekStart);
    bucket?.add(loggedOn);
  }

  return [...daysByWeek.entries()].map(([weekStart, days]) => ({
    weekStart,
    count: days.size,
  }));
}

export function dailyKmSeries(params: {
  samples: readonly { date: string; km: number }[];
  startKey: string;
  endKey: string;
}): number[] {
  const byDay = new Map<string, number>();
  for (const sample of params.samples) {
    const next = (byDay.get(sample.date) ?? 0) + sample.km;
    byDay.set(sample.date, Math.round(next * 10) / 10);
  }
  return inclusiveDateKeys(params.startKey, params.endKey).map(
    (key) => byDay.get(key) ?? 0,
  );
}

export function sumKm(values: readonly number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10;
}

/**
 * Section empty-state: Health first, then missing movement goal.
 * Chart zeros (connected + goal, no sessions yet) are not an empty state.
 */
export function resolveHistoryTrainingEmptyKind(params: {
  healthConnected: boolean;
  hasMovementGoal: boolean;
  hasSessionInRange: boolean;
  hasRunningKm: boolean;
}): HistoryTrainingEmptyKind | null {
  if (params.hasSessionInRange || params.hasRunningKm) {
    return null;
  }
  if (params.healthConnected && params.hasMovementGoal) {
    return null;
  }
  if (!params.healthConnected) {
    return 'connect_health';
  }
  return 'set_movement_goal';
}
