import type { ExerciseKind, SessionSet, WorkoutSession } from '@/lib/workouts/types';

export type SessionExerciseGroup = {
  key: string;
  exerciseId: string | null;
  exerciseName: string;
  position: number;
  kind: ExerciseKind;
  perSide: boolean;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  targetWeightKg: number | null;
  sets: SessionSet[];
};

export function groupSessionSets(session: WorkoutSession): SessionExerciseGroup[] {
  const byKey = new Map<string, SessionExerciseGroup>();
  for (const set of session.sets) {
    const key = set.exerciseId != null ? set.exerciseId : `name:${set.exerciseName}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.sets.push(set);
      continue;
    }
    byKey.set(key, {
      key,
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      position: set.exercisePosition,
      kind: set.kind,
      perSide: set.perSide,
      targetReps: set.targetReps,
      targetRepsMax: set.targetRepsMax,
      targetSeconds: set.targetSeconds,
      targetSecondsMax: set.targetSecondsMax,
      targetWeightKg: set.targetWeightKg,
      sets: [set],
    });
  }
  return [...byKey.values()]
    .map((group) => ({
      ...group,
      sets: group.sets.slice().sort((a, b) => a.setIndex - b.setIndex),
    }))
    .sort((a, b) => a.position - b.position);
}

export function sessionDurationFromTimestamps(session: WorkoutSession): number {
  const end = Date.parse(session.finishedAt ?? session.startedAt);
  const start = Date.parse(session.startedAt);
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) {
    return 1;
  }
  return Math.min(600, Math.max(1, Math.round((end - start) / 60_000)));
}

export function finishedAtFromDuration(startedAt: string, durationMinutes: number): string {
  const start = Date.parse(startedAt);
  const base = Number.isFinite(start) ? start : Date.now();
  return new Date(base + Math.max(1, durationMinutes) * 60_000).toISOString();
}

export function formatActualSetValue(set: SessionSet): string {
  if (set.kind === 'time') {
    if (set.perSide && set.secondsOtherSide != null) {
      return `${set.seconds ?? 0}/${set.secondsOtherSide}`;
    }
    return String(set.seconds ?? 0);
  }
  return String(set.reps ?? 0);
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days between two `YYYY-MM-DD` keys. NaN-safe: an unparseable key yields 0,
 * which leaves the caller's timestamps alone.
 */
export function dayDifference(fromDateKey: string, toDateKey: string): number {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Move a timestamp onto another day, keeping the time of day.
 *
 * Editing a session's date used to change `logged_on` only, so a session moved
 * from the 17th to the 18th still carried `started_at` on the 17th. The duration
 * is derived from those timestamps, so they have to travel with the date.
 */
export function shiftTimestampToDate(
  timestamp: string,
  fromDateKey: string,
  toDateKey: string,
): string {
  const days = dayDifference(fromDateKey, toDateKey);
  if (days === 0) {
    return timestamp;
  }
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return timestamp;
  }
  return new Date(parsed + days * MS_PER_DAY).toISOString();
}
