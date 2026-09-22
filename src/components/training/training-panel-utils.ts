import type { ActiveExercise, ActiveSession, WorkoutTemplate } from '@/lib/workouts/types';
import { parseDateOnly } from '@/lib/day-window';

/** Estimate duration minutes: each set ≈ 45s work + rest. */
export function estimateTemplateMinutes(template: WorkoutTemplate): number {
  let seconds = 0;
  for (const exercise of template.exercises) {
    const rest = exercise.restSeconds ?? exercise.exercise.defaultRestSeconds ?? 90;
    const sets = Math.max(1, exercise.targetSets);
    seconds += sets * (45 + Math.max(0, rest));
  }
  return Math.max(1, Math.round(seconds / 60));
}

export function countTemplateExercises(template: WorkoutTemplate): number {
  return template.exercises.length;
}

/** Calendar days between loggedOn and todayKey (0 = today). */
export function daysSinceLoggedOn(loggedOn: string, todayKey: string): number {
  const a = parseDateOnly(loggedOn).getTime();
  const b = parseDateOnly(todayKey).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function countDoneSets(session: ActiveSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const item of session.items) {
    for (const set of item.sets) {
      total += 1;
      if (set.done) {
        done += 1;
      }
    }
  }
  return { done, total };
}

export function sessionElapsedLabel(startedAt: string, nowMs: number): string {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || nowMs < start) {
    return '00:00';
  }
  const totalSec = Math.floor((nowMs - start) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function medianInt(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return Math.round(sorted[mid]!);
  }
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function doneSetValues(item: ActiveExercise): number[] {
  return item.sets.filter((s) => s.done).map((s) => s.value);
}

export function exerciseStats(session: ActiveSession): {
  setsDone: number;
  repsTotal: number;
  secondsTotal: number;
} {
  let setsDone = 0;
  let repsTotal = 0;
  let secondsTotal = 0;
  for (const item of session.items) {
    for (const set of item.sets) {
      if (!set.done) {
        continue;
      }
      setsDone += 1;
      if (item.kind === 'time') {
        secondsTotal += set.value;
        if (set.secondsOtherSide != null) {
          secondsTotal += set.secondsOtherSide;
        }
      } else {
        repsTotal += set.value;
      }
    }
  }
  return { setsDone, repsTotal, secondsTotal };
}

export function targetLower(item: ActiveExercise): number | null {
  if (item.kind === 'time') {
    return item.targetSeconds;
  }
  return item.targetReps;
}

export function istDiffersFromTarget(item: ActiveExercise): boolean {
  const values = doneSetValues(item);
  if (values.length === 0) {
    return false;
  }
  const lower = targetLower(item);
  if (lower == null) {
    return true;
  }
  return values.some((v) => v !== lower);
}
