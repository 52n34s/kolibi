import type { UnitColorKey } from '@/lib/workouts/types';

export type WeekDayMarker = {
  filled: boolean;
  shortLabel?: string;
  colorKey?: UnitColorKey;
};

type ManualLike = { loggedOn: string };
type WorkoutLike = {
  loggedOn: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  startedAt?: string;
  finishedAt?: string | null;
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday local date keys (self-contained for node tests). */
function weekDateKeys(now: Date = new Date()): string[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysSinceMonday);

  const keys: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    keys.push(dateKey(day));
  }
  return keys;
}

/**
 * Mon–Sun markers: workout session → shortLabel + unit color;
 * only manual training_sessions → filled indigo dot.
 */
export function buildWeekDayMarkers(
  manualSessions: readonly ManualLike[],
  workoutSessions: readonly WorkoutLike[],
  now: Date = new Date(),
): WeekDayMarker[] {
  return buildWeekDayMarkersForKeys(weekDateKeys(now), manualSessions, workoutSessions);
}

/** Markers for an arbitrary Mon–Sun key list (e.g. past weeks in history). */
export function buildWeekDayMarkersForKeys(
  keys: readonly string[],
  manualSessions: readonly ManualLike[],
  workoutSessions: readonly WorkoutLike[],
): WeekDayMarker[] {
  const manualDays = new Set(manualSessions.map((session) => session.loggedOn));

  const workoutByDay = new Map<string, WorkoutLike>();
  const ordered = [...workoutSessions].sort((a, b) => {
    const aAt = a.finishedAt ?? a.startedAt ?? a.loggedOn;
    const bAt = b.finishedAt ?? b.startedAt ?? b.loggedOn;
    return bAt.localeCompare(aAt);
  });
  for (const session of ordered) {
    if (!workoutByDay.has(session.loggedOn)) {
      workoutByDay.set(session.loggedOn, session);
    }
  }

  return keys.map((key) => {
    const workout = workoutByDay.get(key);
    if (workout) {
      return {
        filled: true,
        shortLabel: workout.shortLabel,
        colorKey: workout.colorKey,
      };
    }
    if (manualDays.has(key)) {
      return { filled: true };
    }
    return { filled: false };
  });
}

/** Seven local date keys starting at Monday `weekStartKey`. */
export function weekDateKeysFromMonday(weekStartKey: string): string[] {
  const [y, m, d] = weekStartKey.split('-').map(Number);
  const start = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const keys: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    keys.push(dateKey(day));
  }
  return keys;
}

/** Distinct calendar days across manual + workout session sources. */
export function countDistinctTrainingDaysMerged(
  manualSessions: readonly ManualLike[],
  workoutSessions: readonly ManualLike[],
): number {
  const days = new Set<string>();
  for (const session of manualSessions) {
    days.add(session.loggedOn);
  }
  for (const session of workoutSessions) {
    days.add(session.loggedOn);
  }
  return days.size;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** Monday on or before a local date key. */
export function mondayOnOrBefore(key: string): string {
  const date = parseKey(key);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateKey(date);
}

/** Monday keys of every week touching [startKey, endKey], newest first. */
export function weekStartsNewestFirst(startKey: string, endKey: string): string[] {
  const starts: string[] = [];
  const cursor = parseKey(mondayOnOrBefore(startKey));
  const last = parseKey(mondayOnOrBefore(endKey));
  while (cursor.getTime() <= last.getTime()) {
    starts.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return starts.reverse();
}

/**
 * Days the sessions card of the progress tab covers: the current Mon–Sun week
 * for 7 days, every displayed week row (Monday before the range start through
 * this week) for 30 days.
 */
export function trainingCardDayKeys(params: {
  rangeDays: 7 | 30;
  rangeStartKey: string;
  todayKey: string;
}): string[] {
  if (params.rangeDays === 7) {
    return weekDateKeysFromMonday(mondayOnOrBefore(params.todayKey));
  }
  return weekStartsNewestFirst(params.rangeStartKey, params.todayKey).flatMap(
    weekDateKeysFromMonday,
  );
}

/**
 * Training days the sessions card shows as filled dots — one per calendar day,
 * manual sessions and workouts merged. The recap sticker counts the same way.
 */
export function trainingCardSessionCount(params: {
  rangeDays: 7 | 30;
  rangeStartKey: string;
  todayKey: string;
  manualSessions: readonly ManualLike[];
  workoutSessions: readonly ManualLike[];
}): number {
  const keys = new Set(trainingCardDayKeys(params));
  return countDistinctTrainingDaysMerged(
    params.manualSessions.filter((s) => keys.has(s.loggedOn)),
    params.workoutSessions.filter((s) => keys.has(s.loggedOn)),
  );
}
