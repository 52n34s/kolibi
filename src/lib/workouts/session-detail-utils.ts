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
    const key = set.exerciseId ?? `name:${set.exerciseName}:${set.exercisePosition}`;
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
