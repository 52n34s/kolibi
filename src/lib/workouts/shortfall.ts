import { SHORTFALL_BEST_RATIO, SHORTFALL_SETS_BELOW } from './progression-rules';
import {
  setPerformanceValue,
  type ProgressionHistorySet,
  type ProgressionHistoryUnit,
} from './progression';
import type { ActiveExercise, ExerciseKind } from './types';

/** "Was war los?" chips — same order as on screen and in the DB check. */
export const SHORTFALL_REASONS = [
  'tired',
  'pain',
  'technique',
  'short_on_time',
  'too_hard',
] as const;

export type ShortfallReason = (typeof SHORTFALL_REASONS)[number];

export function isShortfallReason(value: unknown): value is ShortfallReason {
  return typeof value === 'string' && (SHORTFALL_REASONS as readonly string[]).includes(value);
}

/** Known values only, deduped, in chip order. Anything else → []. */
export function normalizeShortfallReasons(value: unknown): ShortfallReason[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return SHORTFALL_REASONS.filter((reason) => value.includes(reason));
}

export function toggleShortfallReason(
  current: readonly ShortfallReason[],
  reason: ShortfallReason,
): ShortfallReason[] {
  const next = current.includes(reason)
    ? current.filter((r) => r !== reason)
    : [...current, reason];
  return normalizeShortfallReasons(next);
}

type Shape = { kind: ExerciseKind; perSide: boolean };

function lowerBoundOf(kind: ExerciseKind, set: ProgressionHistorySet): number | null {
  const lower = kind === 'time' ? set.targetSeconds : set.targetReps;
  return lower != null && Number.isFinite(lower) && lower > 0 ? lower : null;
}

/**
 * Clearly below target: the best done set is under 70 % of the lower bound,
 * or at least two done sets are under the lower bound. Bounds come from each
 * set's own target snapshot. No done sets / no lower bound → false.
 */
export function isClearlyBelowTarget(shape: Shape, sets: readonly ProgressionHistorySet[]): boolean {
  let best: number | null = null;
  let lower: number | null = null;
  let below = 0;
  let counted = 0;
  for (const set of sets) {
    if (!set.done) {
      continue;
    }
    const setLower = lowerBoundOf(shape.kind, set);
    if (setLower == null) {
      continue;
    }
    const value = setPerformanceValue(shape, set) ?? 0;
    counted += 1;
    lower = lower == null ? setLower : Math.max(lower, setLower);
    best = best == null ? value : Math.max(best, value);
    if (value < setLower) {
      below += 1;
    }
  }
  if (counted === 0 || best == null || lower == null) {
    return false;
  }
  return best < lower * SHORTFALL_BEST_RATIO || below >= SHORTFALL_SETS_BELOW;
}

function activeSets(item: ActiveExercise): ProgressionHistorySet[] {
  return item.sets.map((set) => ({
    reps: item.kind === 'time' ? null : set.value,
    seconds: item.kind === 'time' ? set.value : null,
    secondsOtherSide: set.secondsOtherSide,
    targetReps: item.targetReps,
    targetRepsMax: item.targetRepsMax,
    targetSeconds: item.targetSeconds,
    targetSecondsMax: item.targetSecondsMax,
    done: set.done,
  }));
}

export function isActiveItemClearlyBelow(item: ActiveExercise): boolean {
  return isClearlyBelowTarget(item, activeSets(item));
}

/** The summary asks "Was war los?" only when at least one exercise fell clearly short. */
export function sessionHasClearShortfall(items: readonly ActiveExercise[]): boolean {
  return items.some(isActiveItemClearlyBelow);
}

function unitTooHard(shape: Shape, unit: ProgressionHistoryUnit | undefined): boolean {
  if (unit == null) {
    return false;
  }
  const reasons = normalizeShortfallReasons(unit.shortfallReasons ?? []);
  return reasons.includes('too_hard') && isClearlyBelowTarget(shape, unit.sets);
}

/**
 * "zu schwer" twice in a row for this exercise: the latest two sessions that
 * contain it (history newest first, current session included) both picked
 * too_hard and both fell clearly below target on it. Only clearly-below
 * exercises count — the reasons belong to the session, and a strong exercise
 * in the same session was not the one that was too hard.
 */
export function isTooHardStreak(shape: Shape, history: readonly ProgressionHistoryUnit[]): boolean {
  return unitTooHard(shape, history[0]) && unitTooHard(shape, history[1]);
}

/**
 * Reasons to write on finish: only when the card could be shown (a clear
 * shortfall), null when nothing was picked.
 */
export function shortfallReasonsToSave(
  items: readonly ActiveExercise[],
  picked: readonly ShortfallReason[] | undefined,
): ShortfallReason[] | null {
  if (!sessionHasClearShortfall(items)) {
    return null;
  }
  const reasons = normalizeShortfallReasons(picked ?? []);
  return reasons.length > 0 ? reasons : null;
}
