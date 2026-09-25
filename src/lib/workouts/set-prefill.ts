import type { ActiveExercise, ActiveSet, WorkoutSession } from './types';

/**
 * Prefill for open sets of a running session, reps or seconds (per side:
 * both sides):
 * a) a set of this exercise already done in this session → its value
 *    (the one completed last);
 * b) else the same set (same index) of the last finished session with this
 *    exercise_id; that session's last set when it had fewer sets;
 * c) else the lower bound of the target.
 * A value the user changed (`edited`) is never overwritten.
 */
export type PrefillValue = { value: number; secondsOtherSide: number | null };

/** exercise_id → sets of the last finished session with it, in set order. */
export type LastSetsByExercise = Readonly<Record<string, readonly PrefillValue[]>>;

type PrefillExercise = Pick<ActiveExercise, 'kind' | 'targetReps' | 'targetSeconds' | 'sets'>;

function lowerBound(item: Pick<ActiveExercise, 'kind' | 'targetReps' | 'targetSeconds'>): number {
  const lower = item.kind === 'time' ? item.targetSeconds : item.targetReps;
  return Math.max(0, lower ?? 0);
}

function lastDoneSet(sets: readonly ActiveSet[]): ActiveSet | null {
  let best: ActiveSet | null = null;
  let bestIndex = -1;
  sets.forEach((set, index) => {
    if (!set.done) {
      return;
    }
    // Completed last wins; without a timestamp the later position does.
    if (
      best == null ||
      (set.completedAt != null &&
        best.completedAt != null &&
        set.completedAt.localeCompare(best.completedAt) > 0) ||
      ((set.completedAt == null || best.completedAt == null) && index > bestIndex)
    ) {
      best = set;
      bestIndex = index;
    }
  });
  return best;
}

export function prefillSetValue(
  item: PrefillExercise,
  setIndex: number,
  lastSets: readonly PrefillValue[] | null | undefined,
): PrefillValue {
  const done = lastDoneSet(item.sets);
  if (done) {
    return { value: done.value, secondsOtherSide: done.secondsOtherSide };
  }
  if (lastSets && lastSets.length > 0) {
    const source = lastSets[setIndex] ?? lastSets[lastSets.length - 1]!;
    return { value: source.value, secondsOtherSide: source.secondsOtherSide };
  }
  return { value: lowerBound(item), secondsOtherSide: null };
}

/** Prefills every open set the user has not changed. */
export function applySetPrefill<T extends PrefillExercise>(
  item: T,
  lastSets: readonly PrefillValue[] | null | undefined,
): T {
  let changed = false;
  const sets = item.sets.map((set, index) => {
    if (set.done || set.edited) {
      return set;
    }
    const next = prefillSetValue(item, index, lastSets);
    if (next.value === set.value && next.secondsOtherSide === set.secondsOtherSide) {
      return set;
    }
    changed = true;
    return { ...set, value: next.value, secondsOtherSide: next.secondsOtherSide };
  });
  return changed ? { ...item, sets } : item;
}

type HistorySession = Pick<WorkoutSession, 'id' | 'finishedAt' | 'startedAt' | 'loggedOn' | 'sets'>;

/**
 * For each exercise_id, the sets of the newest finished session containing
 * it. Reps for rep exercises, seconds (plus the other side) for holds; sets
 * without a value are left out.
 */
export function lastSetsByExercise(
  sessions: readonly HistorySession[],
  options: { excludeSessionId?: string | null } = {},
): Record<string, PrefillValue[]> {
  const finished = sessions
    .filter((session) => session.finishedAt != null && session.id !== options.excludeSessionId)
    .slice()
    .sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt));

  const out: Record<string, PrefillValue[]> = {};
  for (const session of finished) {
    const byExercise = new Map<string, typeof session.sets>();
    for (const set of session.sets) {
      if (set.exerciseId == null || out[set.exerciseId] != null) {
        continue;
      }
      const list = byExercise.get(set.exerciseId) ?? [];
      list.push(set);
      byExercise.set(set.exerciseId, list);
    }
    for (const [exerciseId, sets] of byExercise) {
      const values = sets
        .slice()
        .sort((a, b) => a.setIndex - b.setIndex)
        .map((set): PrefillValue | null => {
          const value = set.kind === 'time' ? set.seconds : set.reps;
          if (value == null || !Number.isFinite(value) || value < 0) {
            return null;
          }
          return {
            value,
            secondsOtherSide: set.kind === 'time' ? (set.secondsOtherSide ?? null) : null,
          };
        })
        .filter((value): value is PrefillValue => value != null);
      if (values.length > 0) {
        out[exerciseId] = values;
      }
    }
  }
  return out;
}
