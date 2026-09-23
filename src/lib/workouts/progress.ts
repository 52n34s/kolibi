import type { ExerciseKind, SessionSet, UnitColorKey, WorkoutSession } from '@/lib/workouts/types';

export type BestSet = {
  /** Null when the set had no exercise_id (grouped by stored name). */
  exerciseId: string | null;
  exerciseName: string;
  kind: ExerciseKind;
  /** Best single-set value (reps or seconds; per-side time uses min of both sides). */
  value: number;
  completedAt: string;
};

export type PersonalBest = BestSet & {
  previousValue: number;
};

export type SessionVolume = {
  sessionId: string;
  loggedOn: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  reps: number;
  seconds: number;
};

export type WeekVolume = {
  weekStart: string;
  segments: Array<{
    sessionId: string;
    shortLabel: string;
    colorKey: UnitColorKey;
    reps: number;
    seconds: number;
  }>;
  reps: number;
  seconds: number;
};

export type TargetVsActual = {
  targetReps: number;
  actualReps: number;
  targetSeconds: number;
  actualSeconds: number;
};

/** Effective single-set value: reps, or seconds (min of both sides when perSide). */
export function setPerformanceValue(set: SessionSet): number | null {
  if (set.kind === 'time') {
    if (set.seconds == null || !Number.isFinite(set.seconds)) {
      return null;
    }
    if (set.perSide && set.secondsOtherSide != null && Number.isFinite(set.secondsOtherSide)) {
      return Math.min(set.seconds, set.secondsOtherSide);
    }
    return set.seconds;
  }
  if (set.reps == null || !Number.isFinite(set.reps)) {
    return null;
  }
  return set.reps;
}

function bestSetGroupKey(set: SessionSet): string {
  return set.exerciseId != null ? `id:${set.exerciseId}` : `name:${set.exerciseName}`;
}

/**
 * Best completed set per exercise_id (catalog/custom with id).
 * Sets without exercise_id are grouped by exercise_name only.
 * reps → max reps; time → max seconds; perSide time → max of min(sideA, sideB).
 */
export function bestSetByExercise(sets: readonly SessionSet[]): BestSet[] {
  const best = new Map<string, BestSet>();
  for (const set of sets) {
    const value = setPerformanceValue(set);
    if (value == null) {
      continue;
    }
    const key = bestSetGroupKey(set);
    const prev = best.get(key);
    if (
      prev == null ||
      value > prev.value ||
      (value === prev.value && set.completedAt > prev.completedAt)
    ) {
      best.set(key, {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        kind: set.kind,
        value,
        completedAt: set.completedAt,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.value - a.value);
}

/**
 * Personal bests in `rangeSets` that beat `beforeBests`.
 * First-ever execution (no prior best) does not count.
 */
export function personalBests(
  rangeSets: readonly SessionSet[],
  beforeBests: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): PersonalBest[] {
  const before =
    beforeBests instanceof Map
      ? beforeBests
      : new Map(Object.entries(beforeBests));

  const rangeBests = bestSetByExercise(rangeSets);
  const improvements: PersonalBest[] = [];
  for (const best of rangeBests) {
    if (best.exerciseId == null) {
      continue;
    }
    const previous = before.get(best.exerciseId);
    if (previous == null || !(previous > 0)) {
      continue;
    }
    if (best.value > previous) {
      improvements.push({ ...best, previousValue: previous });
    }
  }
  return improvements.sort((a, b) => b.value - a.value || b.completedAt.localeCompare(a.completedAt));
}

export function volumeBySession(sessions: readonly WorkoutSession[]): SessionVolume[] {
  return sessions.map((session) => {
    let reps = 0;
    let seconds = 0;
    for (const set of session.sets) {
      if (set.kind === 'time') {
        const value = setPerformanceValue(set);
        if (value != null) {
          seconds += value;
        }
      } else if (set.reps != null && Number.isFinite(set.reps)) {
        reps += set.reps;
      }
    }
    return {
      sessionId: session.id,
      loggedOn: session.loggedOn,
      shortLabel: session.shortLabel,
      colorKey: session.colorKey,
      reps,
      seconds,
    };
  });
}

function mondayOnOrBefore(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const weekday = date.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Volume rolled up by ISO week (Mon start), newest week first. */
export function volumeByWeek(sessions: readonly WorkoutSession[]): WeekVolume[] {
  const bySession = volumeBySession(sessions);
  const weeks = new Map<string, WeekVolume>();

  for (const vol of bySession) {
    const weekStart = mondayOnOrBefore(vol.loggedOn);
    const bucket = weeks.get(weekStart) ?? {
      weekStart,
      segments: [],
      reps: 0,
      seconds: 0,
    };
    bucket.segments.push({
      sessionId: vol.sessionId,
      shortLabel: vol.shortLabel,
      colorKey: vol.colorKey,
      reps: vol.reps,
      seconds: vol.seconds,
    });
    bucket.reps += vol.reps;
    bucket.seconds += vol.seconds;
    weeks.set(weekStart, bucket);
  }

  return [...weeks.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/**
 * Target vs actual for a finished session.
 * Target = lower bound × completed sets (per exercise summed).
 */
export function targetVsActual(session: WorkoutSession): TargetVsActual {
  let targetReps = 0;
  let actualReps = 0;
  let targetSeconds = 0;
  let actualSeconds = 0;

  for (const set of session.sets) {
    if (set.kind === 'time') {
      const lower = set.targetSeconds;
      if (lower != null && lower > 0) {
        targetSeconds += lower;
      }
      const value = setPerformanceValue(set);
      if (value != null) {
        actualSeconds += value;
      }
    } else {
      const lower = set.targetReps;
      if (lower != null && lower > 0) {
        targetReps += lower;
      }
      if (set.reps != null && Number.isFinite(set.reps)) {
        actualReps += set.reps;
      }
    }
  }

  return { targetReps, actualReps, targetSeconds, actualSeconds };
}

/** Best set value series for sparkline (oldest → newest by completedAt). */
export function exerciseBestSeries(
  sets: readonly SessionSet[],
  exerciseId: string | null,
  exerciseName?: string,
): number[] {
  const filtered = sets
    .filter((set) =>
      exerciseId != null
        ? set.exerciseId === exerciseId
        : set.exerciseId == null && set.exerciseName === exerciseName,
    )
    .slice()
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const bySession = new Map<string, number>();
  for (const set of filtered) {
    const value = setPerformanceValue(set);
    if (value == null) {
      continue;
    }
    const prev = bySession.get(set.sessionId);
    if (prev == null || value > prev) {
      bySession.set(set.sessionId, value);
    }
  }
  // Preserve chronological session order via first appearance in sorted sets
  const ordered: number[] = [];
  const seen = new Set<string>();
  for (const set of filtered) {
    if (seen.has(set.sessionId)) {
      continue;
    }
    const value = bySession.get(set.sessionId);
    if (value == null) {
      continue;
    }
    seen.add(set.sessionId);
    ordered.push(value);
  }
  return ordered;
}
