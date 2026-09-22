import {
  PROGRESSION_DECLINED_COOLDOWN_SESSIONS,
  PROGRESSION_NO_UPPER_BONUS,
  PROGRESSION_REPS_RANGE_DELTA,
  PROGRESSION_REPS_RANGE_MAX,
  PROGRESSION_REPS_RANGE_MIN,
  PROGRESSION_SETS_UP_MAX,
  PROGRESSION_TIME_DELTA,
  PROGRESSION_TIME_RANGE_MIN,
} from '@/lib/workouts/progression-rules';
import type {
  Exercise,
  GymIntensity,
  ProgressionEvent,
  ProgressionEventKind,
  ProgressionTarget,
} from '@/lib/workouts/types';

export type ProgressionHistorySet = {
  reps: number | null;
  seconds: number | null;
  secondsOtherSide: number | null;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
  done: boolean;
};

export type ProgressionHistoryUnit = {
  sessionId: string;
  intensity: GymIntensity | null;
  sets: ProgressionHistorySet[];
};

export type SuggestProgressionInput = {
  exercise: Exercise;
  ladder: Exercise[];
  currentTarget: ProgressionTarget;
  history: ProgressionHistoryUnit[];
  templateExerciseIds: string[];
  lastEvents: ProgressionEvent[];
};

export type ProgressionLevel = {
  ladderKey: string;
  fromStep: number;
  toStep: number;
  total: number;
};

export type ProgressionSuggestion = {
  kind: ProgressionEventKind;
  exerciseId: string;
  toExerciseId: string | null;
  fromTarget: ProgressionTarget;
  toTarget: ProgressionTarget;
  level: ProgressionLevel | null;
  reasonKey: string;
  reasonParams: Record<string, string | number>;
};

function cloneTarget(target: ProgressionTarget): ProgressionTarget {
  return {
    targetSets: target.targetSets,
    targetReps: target.targetReps,
    targetRepsMax: target.targetRepsMax,
    targetSeconds: target.targetSeconds,
    targetSecondsMax: target.targetSecondsMax,
  };
}

function targetsEqual(
  a: Pick<
    ProgressionHistorySet,
    'targetReps' | 'targetRepsMax' | 'targetSeconds' | 'targetSecondsMax'
  >,
  b: ProgressionTarget,
): boolean {
  return (
    a.targetReps === b.targetReps &&
    a.targetRepsMax === b.targetRepsMax &&
    a.targetSeconds === b.targetSeconds &&
    a.targetSecondsMax === b.targetSecondsMax
  );
}

/** Snapshot targets on sets must match currentTarget (any set is enough; all should agree). */
export function isQualifyingUnit(
  unit: ProgressionHistoryUnit,
  currentTarget: ProgressionTarget,
): boolean {
  if (unit.sets.length === 0) {
    return false;
  }
  return unit.sets.every((set) => targetsEqual(set, currentTarget));
}

export function setPerformanceValue(
  exercise: Exercise,
  set: ProgressionHistorySet,
): number | null {
  if (exercise.kind === 'time') {
    if (set.seconds == null || !Number.isFinite(set.seconds)) {
      return null;
    }
    if (exercise.perSide) {
      const other = set.secondsOtherSide;
      if (other != null && Number.isFinite(other)) {
        return Math.min(set.seconds, other);
      }
    }
    return set.seconds;
  }
  if (set.reps == null || !Number.isFinite(set.reps)) {
    return null;
  }
  return set.reps;
}

function lowerBound(exercise: Exercise, target: ProgressionTarget): number | null {
  if (exercise.kind === 'time') {
    return target.targetSeconds;
  }
  return target.targetReps;
}

function upperBound(exercise: Exercise, target: ProgressionTarget): number | null {
  if (exercise.kind === 'time') {
    return target.targetSecondsMax;
  }
  return target.targetRepsMax;
}

export function isUnitSuccess(
  exercise: Exercise,
  unit: ProgressionHistoryUnit,
  currentTarget: ProgressionTarget,
): boolean {
  const done = unit.sets.filter((s) => s.done);
  if (done.length < currentTarget.targetSets) {
    return false;
  }

  const lower = lowerBound(exercise, currentTarget);
  const upper = upperBound(exercise, currentTarget);
  if (lower == null) {
    return false;
  }

  const threshold = upper != null ? upper : lower + PROGRESSION_NO_UPPER_BONUS;
  for (const set of done) {
    const value = setPerformanceValue(exercise, set);
    if (value == null || value < threshold) {
      return false;
    }
  }
  return true;
}

/** More than half of the unit's sets are below the lower target bound. */
export function isUnitWeak(
  exercise: Exercise,
  unit: ProgressionHistoryUnit,
  currentTarget: ProgressionTarget,
): boolean {
  const lower = lowerBound(exercise, currentTarget);
  if (lower == null || unit.sets.length === 0) {
    return false;
  }
  let under = 0;
  for (const set of unit.sets) {
    const value = setPerformanceValue(exercise, set);
    if (value == null || value < lower) {
      under += 1;
    }
  }
  return under > unit.sets.length / 2;
}

function sortLadder(ladder: Exercise[]): Exercise[] {
  return [...ladder].sort((a, b) => (a.ladderStep ?? 0) - (b.ladderStep ?? 0));
}

function stepNeighbor(
  ladder: Exercise[],
  fromStep: number,
  direction: 1 | -1,
): Exercise | null {
  const sorted = sortLadder(ladder);
  const targetStep = fromStep + direction;
  return sorted.find((ex) => ex.ladderStep === targetStep) ?? null;
}

function levelInfo(
  ladderKey: string,
  ladder: Exercise[],
  fromStep: number,
  toStep: number,
): ProgressionLevel {
  return {
    ladderKey,
    fromStep,
    toStep,
    total: sortLadder(ladder).length,
  };
}

function targetFromExerciseDefaults(
  exercise: Exercise,
  targetSets: number,
): ProgressionTarget {
  if (exercise.kind === 'time') {
    return {
      targetSets,
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: exercise.defaultSeconds,
      targetSecondsMax: exercise.defaultSecondsMax,
    };
  }
  return {
    targetSets,
    targetReps: exercise.defaultReps,
    targetRepsMax: exercise.defaultRepsMax,
    targetSeconds: null,
    targetSecondsMax: null,
  };
}

function clampReps(value: number): number {
  return Math.min(PROGRESSION_REPS_RANGE_MAX, Math.max(PROGRESSION_REPS_RANGE_MIN, value));
}

function clampTime(value: number): number {
  return Math.max(PROGRESSION_TIME_RANGE_MIN, value);
}

function qualifyingSinceDecline(
  qualifying: ProgressionHistoryUnit[],
  declined: ProgressionEvent,
): number {
  if (declined.sessionId == null) {
    return qualifying.length;
  }
  const idx = qualifying.findIndex((u) => u.sessionId === declined.sessionId);
  if (idx < 0) {
    return qualifying.length;
  }
  // history / qualifying are newest-first; entries before idx are newer than the declined session
  return idx;
}

function applyDeclineGate(
  suggestion: ProgressionSuggestion,
  qualifying: ProgressionHistoryUnit[],
  lastEvents: ProgressionEvent[],
): ProgressionSuggestion | null {
  const last = lastEvents[0];
  if (last == null || last.status !== 'declined' || last.kind !== suggestion.kind) {
    return suggestion;
  }
  if (qualifyingSinceDecline(qualifying, last) >= PROGRESSION_DECLINED_COOLDOWN_SESSIONS) {
    return suggestion;
  }
  return null;
}

function buildAscent(
  input: SuggestProgressionInput,
  qualifying: ProgressionHistoryUnit[],
): ProgressionSuggestion | null {
  const { exercise, ladder, currentTarget, templateExerciseIds } = input;
  const latest = qualifying[0]!;
  let success = isUnitSuccess(exercise, latest, currentTarget);
  if (success && latest.intensity === 'hard') {
    const prev = qualifying[1];
    if (prev == null || !isUnitSuccess(exercise, prev, currentTarget)) {
      success = false;
    }
  }
  if (!success) {
    return null;
  }

  const fromTarget = cloneTarget(currentTarget);
  const inTemplate = new Set(templateExerciseIds);

  if (exercise.progressionKind === 'load') {
    return {
      kind: 'load_up',
      exerciseId: exercise.id,
      toExerciseId: null,
      fromTarget,
      toTarget: cloneTarget(currentTarget),
      level: null,
      reasonKey: 'training.progression.reason.loadUp',
      reasonParams: {},
    };
  }

  if (exercise.kind === 'time') {
    const max = currentTarget.targetSecondsMax;
    const cap = exercise.timeCapSeconds;
    if (
      max != null &&
      cap != null &&
      max + PROGRESSION_TIME_DELTA <= cap
    ) {
      return {
        kind: 'time_up',
        exerciseId: exercise.id,
        toExerciseId: null,
        fromTarget,
        toTarget: {
          ...cloneTarget(currentTarget),
          targetSeconds:
            currentTarget.targetSeconds == null
              ? null
              : currentTarget.targetSeconds + PROGRESSION_TIME_DELTA,
          targetSecondsMax: max + PROGRESSION_TIME_DELTA,
        },
        level: null,
        reasonKey: 'training.progression.reason.timeUp',
        reasonParams: { delta: PROGRESSION_TIME_DELTA },
      };
    }

    if (exercise.ladderKey != null && exercise.ladderStep != null) {
      const next = stepNeighbor(ladder, exercise.ladderStep, 1);
      if (next != null && !inTemplate.has(next.id)) {
        return {
          kind: 'variant_up',
          exerciseId: exercise.id,
          toExerciseId: next.id,
          fromTarget,
          toTarget: targetFromExerciseDefaults(next, currentTarget.targetSets),
          level: levelInfo(exercise.ladderKey, ladder, exercise.ladderStep, next.ladderStep!),
          reasonKey: 'training.progression.reason.variantUp',
          reasonParams: {
            fromStep: exercise.ladderStep,
            toStep: next.ladderStep!,
          },
        };
      }
    }

    if (currentTarget.targetSets < PROGRESSION_SETS_UP_MAX) {
      return {
        kind: 'sets_up',
        exerciseId: exercise.id,
        toExerciseId: null,
        fromTarget,
        toTarget: {
          ...cloneTarget(currentTarget),
          targetSets: currentTarget.targetSets + 1,
        },
        level: null,
        reasonKey: 'training.progression.reason.setsUp',
        reasonParams: { sets: currentTarget.targetSets + 1 },
      };
    }

    return null;
  }

  // reps / weighted + variant (or fallback when not load/none)
  if (exercise.progressionKind === 'variant') {
    if (exercise.ladderKey != null && exercise.ladderStep != null) {
      const next = stepNeighbor(ladder, exercise.ladderStep, 1);
      if (next != null && !inTemplate.has(next.id)) {
        return {
          kind: 'variant_up',
          exerciseId: exercise.id,
          toExerciseId: next.id,
          fromTarget,
          toTarget: targetFromExerciseDefaults(next, currentTarget.targetSets),
          level: levelInfo(exercise.ladderKey, ladder, exercise.ladderStep, next.ladderStep!),
          reasonKey: 'training.progression.reason.variantUp',
          reasonParams: {
            fromStep: exercise.ladderStep,
            toStep: next.ladderStep!,
          },
        };
      }
    }

    if (currentTarget.targetSets < PROGRESSION_SETS_UP_MAX) {
      return {
        kind: 'sets_up',
        exerciseId: exercise.id,
        toExerciseId: null,
        fromTarget,
        toTarget: {
          ...cloneTarget(currentTarget),
          targetSets: currentTarget.targetSets + 1,
        },
        level: null,
        reasonKey: 'training.progression.reason.setsUp',
        reasonParams: { sets: currentTarget.targetSets + 1 },
      };
    }

    const min = currentTarget.targetReps ?? 0;
    const max = currentTarget.targetRepsMax ?? min;
    return {
      kind: 'range_up',
      exerciseId: exercise.id,
      toExerciseId: null,
      fromTarget,
      toTarget: {
        ...cloneTarget(currentTarget),
        targetReps: clampReps(min + PROGRESSION_REPS_RANGE_DELTA),
        targetRepsMax: clampReps(max + PROGRESSION_REPS_RANGE_DELTA),
      },
      level: null,
      reasonKey: 'training.progression.reason.rangeUp',
      reasonParams: { delta: PROGRESSION_REPS_RANGE_DELTA },
    };
  }

  return null;
}

function buildDescent(
  input: SuggestProgressionInput,
  qualifying: ProgressionHistoryUnit[],
): ProgressionSuggestion | null {
  if (qualifying.length < 2) {
    return null;
  }
  const a = qualifying[0]!;
  const b = qualifying[1]!;
  const { exercise, ladder, currentTarget, templateExerciseIds } = input;
  if (
    !isUnitWeak(exercise, a, currentTarget) ||
    !isUnitWeak(exercise, b, currentTarget)
  ) {
    return null;
  }

  const fromTarget = cloneTarget(currentTarget);
  const inTemplate = new Set(templateExerciseIds);

  if (exercise.ladderKey != null && exercise.ladderStep != null) {
    const prev = stepNeighbor(ladder, exercise.ladderStep, -1);
    if (prev != null && !inTemplate.has(prev.id)) {
      return {
        kind: 'variant_down',
        exerciseId: exercise.id,
        toExerciseId: prev.id,
        fromTarget,
        toTarget: targetFromExerciseDefaults(prev, currentTarget.targetSets),
        level: levelInfo(exercise.ladderKey, ladder, exercise.ladderStep, prev.ladderStep!),
        reasonKey: 'training.progression.reason.variantDown',
        reasonParams: {
          fromStep: exercise.ladderStep,
          toStep: prev.ladderStep!,
        },
      };
    }
  }

  if (exercise.kind === 'time') {
    const min = currentTarget.targetSeconds ?? PROGRESSION_TIME_RANGE_MIN;
    const max = currentTarget.targetSecondsMax ?? min;
    return {
      kind: 'range_down',
      exerciseId: exercise.id,
      toExerciseId: null,
      fromTarget,
      toTarget: {
        ...cloneTarget(currentTarget),
        targetSeconds: clampTime(min - PROGRESSION_TIME_DELTA),
        targetSecondsMax: clampTime(max - PROGRESSION_TIME_DELTA),
      },
      level: null,
      reasonKey: 'training.progression.reason.rangeDown',
      reasonParams: { delta: PROGRESSION_TIME_DELTA },
    };
  }

  const min = currentTarget.targetReps ?? PROGRESSION_REPS_RANGE_MIN;
  const max = currentTarget.targetRepsMax ?? min;
  return {
    kind: 'range_down',
    exerciseId: exercise.id,
    toExerciseId: null,
    fromTarget,
    toTarget: {
      ...cloneTarget(currentTarget),
      targetReps: clampReps(min - PROGRESSION_REPS_RANGE_DELTA),
      targetRepsMax: clampReps(max - PROGRESSION_REPS_RANGE_DELTA),
    },
    level: null,
    reasonKey: 'training.progression.reason.rangeDown',
    reasonParams: { delta: PROGRESSION_REPS_RANGE_DELTA },
  };
}

/**
 * Pure progression suggestion for one exercise in one template context.
 * Returns at most one suggestion (rule h).
 */
export function suggestProgression(input: SuggestProgressionInput): ProgressionSuggestion | null {
  if (input.exercise.progressionKind === 'none') {
    return null;
  }

  const qualifying = input.history.filter((unit) =>
    isQualifyingUnit(unit, input.currentTarget),
  );
  if (qualifying.length === 0) {
    return null;
  }

  const ascent = buildAscent(input, qualifying);
  if (ascent != null) {
    return applyDeclineGate(ascent, qualifying, input.lastEvents);
  }

  const descent = buildDescent(input, qualifying);
  if (descent != null) {
    return applyDeclineGate(descent, qualifying, input.lastEvents);
  }

  return null;
}
