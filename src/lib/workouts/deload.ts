import { daysBetweenKeys } from '@/lib/recommendations/recommendations';
import type { ReadinessLevel } from '@/lib/checkin/readiness';

/**
 * When a lighter week is the better next step.
 *
 * Two independent criteria, either is enough: the body says it (weeks of
 * training without a break plus gentle days in a row) or the numbers say it
 * (performance down on several exercises plus check-ins clearly worse than
 * usual). Both together still make one suggestion.
 *
 * The suggestion is a nudge, not a rule, so it stays rare: at most once every
 * four weeks, and never while a deload is already running.
 *
 * Every threshold lives in DELOAD_RULES so tests and the report point at the
 * same numbers. Missing inputs simply mean the criterion that needs them
 * stays quiet.
 */

export const DELOAD_RULES = {
  /** At most one suggestion every four weeks. */
  suggestCooldownDays: 28,
  /** Criterion 1 looks at four calendar weeks … */
  minWeeksContinuousTraining: 4,
  /** … and needs two gentle days … */
  gentleDaysNeededInLast4: 2,
  /** … among the last four days. */
  lookbackGentleDays: 4,
  /** Criterion 2 looks at the last two finished units … */
  performanceDropUnits: 2,
  /** … and needs a drop on at least two exercises … */
  exercisesWithDropMin: 2,
  /** … plus three clearly worse check-ins … */
  checkinsWorseMin: 3,
  /** … among the last five. */
  checkinsLookback: 5,
  /** A week is "lighter" below 85 % of the mean of the other weeks in the window. */
  lighterWeekRatio: 0.85,
  /** A best below 90 % of the personal average counts as a drop. */
  performanceDropRatio: 0.9,
  /** "Clearly worse": energy a full point under, or soreness a full point over, the average. */
  checkinWorseDelta: 1,
} as const;

/** The texts around a deload, so screen and test point at the same keys. */
export const DELOAD_TEXT_KEYS = {
  message: 'recommendations.deload.message',
  actionStart: 'recommendations.deload.actionStart',
  actionDismiss: 'recommendations.deload.actionDismiss',
  /** "Leichtere Woche – bis {{date}}" over the training tab. */
  banner: 'training.deload.banner',
} as const;

export type DeloadWeek = {
  /** Local date key of the Monday, YYYY-MM-DD. */
  weekStartKey: string;
  setCount: number;
};

export type DeloadReadinessDay = {
  /** Local date key YYYY-MM-DD. */
  dateKey: string;
  /** null = no check-in that day. */
  level: ReadinessLevel | null;
};

export type DeloadUnit = {
  exercises: readonly { exerciseId: string; bestLoadOrReps: number }[];
};

export type DeloadExerciseHistory = {
  exerciseId: string;
  /** Earlier bests of this exercise; their mean is the personal average. */
  values: readonly number[];
};

/** Energy and soreness on the 1 … 5 check-in scale. */
export type DeloadCheckin = { energy: number; soreness: number };

export type DeloadContext = {
  /** Epoch ms, for the cooldown since the last suggestion. */
  nowMs: number;
  /** Local date key YYYY-MM-DD. */
  todayKey: string;
  /** ISO timestamp of the last suggestion; null = never suggested. */
  lastSuggestedAt: string | null;
  /** Date key the running deload ends on; null = no deload. */
  deloadUntil: string | null;
  /** Date keys with a real session, any order. */
  trainingDayKeys: readonly string[];
  /** Weekly set volume, at least the last four weeks; any order. */
  weekVolumes: readonly DeloadWeek[];
  /** Readiness per day; only the last `lookbackGentleDays` days count. */
  recentReadiness: readonly DeloadReadinessDay[];
  /** Finished units, chronological, newest last. */
  recentUnits: readonly DeloadUnit[];
  /** Older values per exercise, for the personal average. */
  exerciseHistory: readonly DeloadExerciseHistory[];
  /** Check-ins, newest first. */
  recentCheckins: readonly DeloadCheckin[];
  /** Personal average; null = the check-in half of criterion 2 can't be judged. */
  checkinAverages: DeloadCheckin | null;
};

export type DeloadSuggestion = {
  shouldSuggest: boolean;
  reason: 'load_and_gentle' | 'performance_and_checkin' | null;
};

const NO_SUGGESTION: DeloadSuggestion = { shouldSuggest: false, reason: null };

/** A running deload covers today and every day up to its end key. */
export function isDeloadActive(deloadUntil: string | null, todayKey: string): boolean {
  return deloadUntil != null && deloadUntil >= todayKey;
}

/** One set less, but never below a single set. */
export function deloadSets(targetSets: number): number {
  return Math.max(1, targetSets - 1);
}

export function isInSuggestCooldown(lastSuggestedAt: string | null, nowMs: number): boolean {
  if (!lastSuggestedAt) {
    return false;
  }
  const at = Date.parse(lastSuggestedAt);
  if (!Number.isFinite(at)) {
    return false;
  }
  return nowMs - at < DELOAD_RULES.suggestCooldownDays * 24 * 60 * 60 * 1000;
}

/** The `minWeeksContinuousTraining` most recent weeks, oldest first. */
function weekWindow(weeks: readonly DeloadWeek[]): DeloadWeek[] {
  return [...weeks]
    .sort((a, b) => a.weekStartKey.localeCompare(b.weekStartKey))
    .slice(-DELOAD_RULES.minWeeksContinuousTraining);
}

/** At least one session in each of the last four weeks (Monday to Sunday). */
export function hasContinuousTraining(
  weeks: readonly DeloadWeek[],
  trainingDayKeys: readonly string[],
): boolean {
  const window = weekWindow(weeks);
  if (window.length < DELOAD_RULES.minWeeksContinuousTraining) {
    return false;
  }
  return window.every((week) =>
    trainingDayKeys.some((dayKey) => {
      const offset = daysBetweenKeys(week.weekStartKey, dayKey);
      return offset != null && offset >= 0 && offset <= 6;
    }),
  );
}

/**
 * A week in the window that already was the lighter one: its set count is
 * below 85 % of the mean of the other weeks in the window. One is enough —
 * then the body got its break and criterion 1 stays quiet.
 */
export function hasLighterWeek(weeks: readonly DeloadWeek[]): boolean {
  const window = weekWindow(weeks);
  if (window.length < DELOAD_RULES.minWeeksContinuousTraining) {
    return false;
  }
  return window.some((week, index) => {
    const others = window.filter((_, other) => other !== index);
    const mean = others.reduce((acc, item) => acc + item.setCount, 0) / others.length;
    return mean > 0 && week.setCount < mean * DELOAD_RULES.lighterWeekRatio;
  });
}

/** Gentle days among the last `lookbackGentleDays` days, each day counted once. */
export function gentleDayCount(
  recentReadiness: readonly DeloadReadinessDay[],
  todayKey: string,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const day of recentReadiness) {
    const age = daysBetweenKeys(day.dateKey, todayKey);
    if (age == null || age < 0 || age >= DELOAD_RULES.lookbackGentleDays) {
      continue;
    }
    if (seen.has(day.dateKey)) {
      continue;
    }
    seen.add(day.dateKey);
    if (day.level === 'gentle') {
      count += 1;
    }
  }
  return count;
}

/**
 * Exercises in the last two units whose best fell below 90 % of the personal
 * average. Without two units there is nothing to compare, and an exercise
 * without history is never a drop.
 */
export function exercisesWithDrop(
  recentUnits: readonly DeloadUnit[],
  exerciseHistory: readonly DeloadExerciseHistory[],
): number {
  const units = recentUnits.slice(-DELOAD_RULES.performanceDropUnits);
  if (units.length < DELOAD_RULES.performanceDropUnits) {
    return 0;
  }
  const averages = new Map<string, number>();
  for (const row of exerciseHistory) {
    const values = row.values.filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      continue;
    }
    averages.set(row.exerciseId, values.reduce((acc, value) => acc + value, 0) / values.length);
  }
  const dropped = new Set<string>();
  for (const unit of units) {
    for (const exercise of unit.exercises) {
      const average = averages.get(exercise.exerciseId);
      if (average == null || !(average > 0) || !Number.isFinite(exercise.bestLoadOrReps)) {
        continue;
      }
      if (exercise.bestLoadOrReps < average * DELOAD_RULES.performanceDropRatio) {
        dropped.add(exercise.exerciseId);
      }
    }
  }
  return dropped.size;
}

/** Check-ins among the last five with energy or soreness a full point worse than usual. */
export function worseCheckinCount(
  recentCheckins: readonly DeloadCheckin[],
  averages: DeloadCheckin | null,
): number {
  if (averages == null) {
    return 0;
  }
  const { checkinWorseDelta } = DELOAD_RULES;
  return recentCheckins
    .slice(0, DELOAD_RULES.checkinsLookback)
    .filter(
      (checkin) =>
        checkin.energy <= averages.energy - checkinWorseDelta ||
        checkin.soreness >= averages.soreness + checkinWorseDelta,
    ).length;
}

export function suggestDeload(ctx: DeloadContext): DeloadSuggestion {
  if (isDeloadActive(ctx.deloadUntil, ctx.todayKey)) {
    return NO_SUGGESTION;
  }
  if (isInSuggestCooldown(ctx.lastSuggestedAt, ctx.nowMs)) {
    return NO_SUGGESTION;
  }

  // Four weeks of training without a lighter one, and the last days felt gentle.
  const loadAndGentle =
    hasContinuousTraining(ctx.weekVolumes, ctx.trainingDayKeys) &&
    !hasLighterWeek(ctx.weekVolumes) &&
    gentleDayCount(ctx.recentReadiness, ctx.todayKey) >= DELOAD_RULES.gentleDaysNeededInLast4;
  if (loadAndGentle) {
    return { shouldSuggest: true, reason: 'load_and_gentle' };
  }

  // Or: the sets got weaker and the check-ins agree.
  const performanceAndCheckin =
    exercisesWithDrop(ctx.recentUnits, ctx.exerciseHistory) >= DELOAD_RULES.exercisesWithDropMin &&
    worseCheckinCount(ctx.recentCheckins, ctx.checkinAverages) >= DELOAD_RULES.checkinsWorseMin;
  return performanceAndCheckin
    ? { shouldSuggest: true, reason: 'performance_and_checkin' }
    : NO_SUGGESTION;
}
