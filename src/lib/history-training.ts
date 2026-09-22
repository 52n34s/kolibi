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

export function loggedOnInRange(
  loggedOn: string,
  startKey: string,
  endKey: string,
): boolean {
  return loggedOn >= startKey && loggedOn <= endKey;
}

/**
 * Distinct training days per Monday-start week overlapping the range (4–5
 * weeks in a 30-day window). Counts the full Mon–Sun week, not only days
 * inside `startKey`…`endKey`, so the first bar is a real week rather than a stub.
 * Days after `endKey` (today) are ignored.
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
    if (loggedOn > params.endKey) {
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

/** Weeks whose distinct training days meet `training_sessions_per_week`. */
export function countWeeksOnTrainingTarget(params: {
  weeklyCounts: ReadonlyArray<{ count: number }>;
  sessionsPerWeek: number;
}): { onTarget: number; weekCount: number } {
  const weekCount = params.weeklyCounts.length;
  if (params.sessionsPerWeek < 1) {
    return { onTarget: 0, weekCount };
  }
  const onTarget = params.weeklyCounts.filter(
    (week) => week.count >= params.sessionsPerWeek,
  ).length;
  return { onTarget, weekCount };
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
