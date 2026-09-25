import { PROGRESSION_NO_UPPER_BONUS } from '@/lib/workouts/progression-rules';
import type { ActiveExercise } from '@/lib/workouts/types';

/**
 * Small line under the set input during a session: what the next level asks
 * for, or that the planned sets already reached it. Same threshold as the
 * progression (upper bound; lower + PROGRESSION_NO_UPPER_BONUS on a ladder
 * without a range) and the same planned sets (the first targetSets done sets).
 */
export type NextLevelHint =
  | { kind: 'target'; value: number; sets: number; unit: 'reps' | 'seconds'; perSide: boolean }
  | { kind: 'reached' };

type HintExercise = Pick<
  ActiveExercise,
  'kind' | 'perSide' | 'targetSets' | 'targetReps' | 'targetRepsMax' | 'targetSeconds' | 'targetSecondsMax' | 'sets'
>;

function range(item: HintExercise): { lower: number | null; upper: number | null } {
  return item.kind === 'time'
    ? { lower: item.targetSeconds, upper: item.targetSecondsMax }
    : { lower: item.targetReps, upper: item.targetRepsMax };
}

/**
 * Null for fixed targets without a range off a ladder: there is no "next
 * level" to point at there.
 */
export function nextLevelHint(
  item: HintExercise,
  options: { onLadder: boolean },
): NextLevelHint | null {
  if (item.targetSets < 1) {
    return null;
  }
  const { lower, upper } = range(item);
  const hasRange = upper != null && lower != null && upper > lower;
  if (!hasRange && !options.onLadder) {
    return null;
  }
  const threshold = hasRange ? upper : lower != null ? lower + PROGRESSION_NO_UPPER_BONUS : null;
  if (threshold == null) {
    return null;
  }

  const planned = item.sets.filter((set) => set.done).slice(0, item.targetSets);
  const reached =
    planned.length >= item.targetSets &&
    planned.every((set) => {
      const value =
        item.kind === 'time' && item.perSide && set.secondsOtherSide != null
          ? Math.min(set.value, set.secondsOtherSide)
          : set.value;
      return value >= threshold;
    });
  if (reached) {
    return { kind: 'reached' };
  }
  return {
    kind: 'target',
    value: threshold,
    sets: item.targetSets,
    unit: item.kind === 'time' ? 'seconds' : 'reps',
    perSide: item.perSide,
  };
}

export type HintTranslate = (key: string, options?: Record<string, unknown>) => string;

export function formatNextLevelHint(hint: NextLevelHint, t: HintTranslate): string {
  if (hint.kind === 'reached') {
    return t('training.panel.nextLevel.reached');
  }
  const amount = hint.unit === 'seconds' ? `${hint.value} s` : String(hint.value);
  const max = hint.perSide ? `${amount} ${t('training.timer.perSide')}` : amount;
  return t('training.panel.nextLevel.target', { max, count: hint.sets });
}
