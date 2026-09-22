import type { ExerciseKind } from '@/lib/workouts/types';

export type FormatTargetInput = {
  sets: number;
  kind: ExerciseKind;
  reps?: number | null;
  repsMax?: number | null;
  seconds?: number | null;
  secondsMax?: number | null;
  perSide?: boolean;
  /** Localized "per side" suffix, e.g. "pro Seite". When omitted, no suffix. */
  perSideLabel?: string | null;
};

/**
 * "3 × 8–12", "2 × 20–40 s", or without max "3 × 8" / "3 × 30 s".
 * Optional per-side label appended when perSide and label provided.
 */
export function formatExerciseTarget(input: FormatTargetInput): string {
  const sets = Math.max(0, Math.round(input.sets));
  let body: string;

  if (input.kind === 'time') {
    const min = input.seconds;
    const max = input.secondsMax;
    if (min == null || !(min > 0)) {
      body = `${sets} × –`;
    } else if (max != null && max > min) {
      body = `${sets} × ${min}–${max} s`;
    } else {
      body = `${sets} × ${min} s`;
    }
  } else {
    const min = input.reps;
    const max = input.repsMax;
    if (min == null || !(min > 0)) {
      body = `${sets} × –`;
    } else if (max != null && max > min) {
      body = `${sets} × ${min}–${max}`;
    } else {
      body = `${sets} × ${min}`;
    }
  }

  if (input.perSide && input.perSideLabel) {
    return `${body} ${input.perSideLabel}`;
  }
  return body;
}

/** True when every completed set value meets or exceeds the upper target bound. */
export function allSetsHitUpperBound(params: {
  kind: ExerciseKind;
  targetRepsMax: number | null;
  targetSecondsMax: number | null;
  setValues: readonly number[];
}): boolean {
  const bound =
    params.kind === 'time' ? params.targetSecondsMax : params.targetRepsMax;
  if (bound == null || !(bound > 0) || params.setValues.length === 0) {
    return false;
  }
  return params.setValues.every((value) => value >= bound);
}

/** Target range without set count — e.g. "8–12" or "30–40 s". */
export function formatTargetRange(input: {
  kind: ExerciseKind;
  reps?: number | null;
  repsMax?: number | null;
  seconds?: number | null;
  secondsMax?: number | null;
}): string {
  if (input.kind === 'time') {
    const min = input.seconds;
    const max = input.secondsMax;
    if (min == null || !(min > 0)) {
      return '–';
    }
    if (max != null && max > min) {
      return `${min}–${max} s`;
    }
    return `${min} s`;
  }
  const min = input.reps;
  const max = input.repsMax;
  if (min == null || !(min > 0)) {
    return '–';
  }
  if (max != null && max > min) {
    return `${min}–${max}`;
  }
  return String(min);
}
