import type { ActiveExercise, GymIntensity, SessionSet } from '@/lib/workouts/types';
import type {
  ProgressionHistorySet,
  ProgressionHistoryUnit,
} from '@/lib/workouts/progression';

export function activeItemToHistoryUnit(
  item: ActiveExercise,
  sessionId: string,
  intensity: GymIntensity | null,
): ProgressionHistoryUnit {
  return {
    sessionId,
    intensity,
    sets: item.sets.map(
      (set): ProgressionHistorySet => ({
        reps: item.kind === 'time' ? null : set.value,
        seconds: item.kind === 'time' ? set.value : null,
        secondsOtherSide: set.secondsOtherSide,
        targetReps: item.targetReps,
        targetRepsMax: item.targetRepsMax,
        targetSeconds: item.targetSeconds,
        targetSecondsMax: item.targetSecondsMax,
        done: set.done,
      }),
    ),
  };
}

/**
 * Sets are synced while the session runs, so history fetched for its summary
 * already contains the session itself. Comparisons need the earlier ones only.
 */
export function withoutSession<T extends { sessionId: string }>(rows: T[], sessionId: string): T[] {
  return rows.filter((row) => row.sessionId !== sessionId);
}

/** Group flat history sets (newest first) into units, newest first. */
export function sessionSetsToHistoryUnits(
  sets: SessionSet[],
  intensityBySessionId: Record<string, GymIntensity | null>,
): ProgressionHistoryUnit[] {
  const order: string[] = [];
  const bySession = new Map<string, SessionSet[]>();
  for (const set of sets) {
    const list = bySession.get(set.sessionId);
    if (list) {
      list.push(set);
    } else {
      bySession.set(set.sessionId, [set]);
      order.push(set.sessionId);
    }
  }

  return order.map((sessionId) => {
    const sessionSets = (bySession.get(sessionId) ?? []).slice().sort((a, b) => a.setIndex - b.setIndex);
    return {
      sessionId,
      intensity: intensityBySessionId[sessionId] ?? null,
      sets: sessionSets.map(
        (set): ProgressionHistorySet => ({
          reps: set.reps,
          seconds: set.seconds,
          secondsOtherSide: set.secondsOtherSide,
          targetReps: set.targetReps,
          targetRepsMax: set.targetRepsMax,
          targetSeconds: set.targetSeconds,
          targetSecondsMax: set.targetSecondsMax,
          done: true,
        }),
      ),
    };
  });
}
