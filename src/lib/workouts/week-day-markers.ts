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
