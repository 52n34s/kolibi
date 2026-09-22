import type { ExerciseKind } from './types';

export type AdoptedTarget = {
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
};

/**
 * Raise an existing upper bound so it never falls below the new lower bound.
 * `null` stays `null` — an exercise without a range keeps having none.
 */
export function adoptedUpperBound(
  currentMax: number | null | undefined,
  median: number,
): number | null {
  if (currentMax == null) {
    return null;
  }
  return Math.max(currentMax, median);
}

/**
 * "Als neues Ziel übernehmen": the session median becomes the lower bound.
 * When the median lands above the old upper bound, the range would invert
 * (min > max) and `formatExerciseTarget` would silently drop it — so the
 * upper bound moves up with it.
 */
export function adoptTargetFromMedian(input: {
  kind: ExerciseKind;
  median: number;
  targetRepsMax: number | null;
  targetSecondsMax: number | null;
}): AdoptedTarget {
  const median = Math.max(0, Math.round(input.median));

  if (input.kind === 'time') {
    return {
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: median,
      targetSecondsMax: adoptedUpperBound(input.targetSecondsMax, median),
    };
  }

  return {
    targetReps: median,
    targetRepsMax: adoptedUpperBound(input.targetRepsMax, median),
    targetSeconds: null,
    targetSecondsMax: null,
  };
}
