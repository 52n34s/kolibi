import type { UnitSystem } from '@/lib/unit-system';
import { setPerformanceValue } from '@/lib/workouts/progress';
import type { ExerciseKind, ProgressionEventKind, ProgressionEventStatus, SessionSet } from '@/lib/workouts/types';

/**
 * Build-up view: weight, waist, chest, upper arm and strength over 4/8/12 weeks.
 *
 * Window: the `weeks * 7` calendar days ending today, i.e. startKey =
 * today − (weeks * 7 − 1).
 *
 * Weight: mean of the weigh-ins in the last 7 days (today − 6 … today) against
 * the mean of a 7-day baseline window. Baseline is the 7 days ending on
 * startKey; when they hold no weigh-in, the 7 days from the first weigh-in in
 * the window. Both windows must not overlap. |Δ| < 0.3 kg reads "stable".
 *
 * Circumferences: latest value in the window against a baseline — the latest
 * value in the 14 days before startKey, else the earliest value in the window.
 * The two must be on different days. |Δ| < 0.5 cm reads "stable".
 *
 * Strength: accepted ladder level-ups (variant_up) in the window, plus the best
 * set gains of the main exercises — the three exercises with the most sets in
 * the window. A gain is the best set in the window above the best set before
 * the window (a first execution does not count). The sentence shows up to two.
 */

export type BuildUpWeeks = 4 | 8 | 12;
export const BUILD_UP_WEEK_OPTIONS: readonly BuildUpWeeks[] = [4, 8, 12];

/** Scale noise / water; below this weight reads "stable" (same as history-body-metrics). */
export const BUILD_UP_WEIGHT_STABLE_KG = 0.3;
/** Tape-measure noise; below this a circumference reads "stable". */
export const BUILD_UP_CIRCUMFERENCE_STABLE_CM = 0.5;
export const BUILD_UP_AVERAGE_DAYS = 7;
/** How far before the window a circumference baseline may lie. */
export const BUILD_UP_BASELINE_LOOKBACK_DAYS = 14;
export const BUILD_UP_MAIN_EXERCISES = 3;
export const BUILD_UP_MAX_EXERCISES_IN_SENTENCE = 2;

export type DatedValue = { on: string; value: number };

export type BuildUpSession = { loggedOn: string; sets: readonly SessionSet[] };

export type BuildUpProgressionEvent = {
  kind: ProgressionEventKind;
  status: ProgressionEventStatus;
  /** Local calendar day of created_at. */
  day: string;
};

export type BuildUpInput = {
  todayKey: string;
  weeks: BuildUpWeeks;
  weightKg: readonly DatedValue[];
  waistCm: readonly DatedValue[];
  chestCm: readonly DatedValue[];
  armCm: readonly DatedValue[];
  sessions: readonly BuildUpSession[];
  /** Best set value per exercise id before startKey. */
  beforeBests: Readonly<Record<string, number>>;
  progressionEvents: readonly BuildUpProgressionEvent[];
};

export type BuildUpExerciseGain = {
  exerciseId: string;
  exerciseName: string;
  kind: ExerciseKind;
  delta: number;
};

export type BuildUpSummary = {
  startKey: string;
  /** Null when there is no pair to compare. */
  weightDeltaKg: number | null;
  waistDeltaCm: number | null;
  chestDeltaCm: number | null;
  armDeltaCm: number | null;
  levelUps: number;
  exerciseGains: BuildUpExerciseGain[];
};

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

export function shiftDayKey(key: string, days: number): string {
  const date = new Date((dayNumber(key) + days) * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildUpStartKey(todayKey: string, weeks: BuildUpWeeks): string {
  return shiftDayKey(todayKey, -(weeks * 7 - 1));
}

function valid(values: readonly DatedValue[]): DatedValue[] {
  return values
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .slice()
    .sort((a, b) => a.on.localeCompare(b.on));
}

function meanBetween(values: readonly DatedValue[], fromKey: string, toKey: string): number | null {
  let sum = 0;
  let count = 0;
  for (const entry of values) {
    if (entry.on >= fromKey && entry.on <= toKey) {
      sum += entry.value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

export function weightAverageDelta(
  weights: readonly DatedValue[],
  startKey: string,
  todayKey: string,
): number | null {
  const sorted = valid(weights);
  const endFrom = shiftDayKey(todayKey, -(BUILD_UP_AVERAGE_DAYS - 1));
  const endAvg = meanBetween(sorted, endFrom, todayKey);
  if (endAvg == null) {
    return null;
  }
  let baseFrom = shiftDayKey(startKey, -(BUILD_UP_AVERAGE_DAYS - 1));
  let baseTo = startKey;
  let baseAvg = meanBetween(sorted, baseFrom, baseTo);
  if (baseAvg == null) {
    const first = sorted.find((entry) => entry.on > startKey && entry.on <= todayKey);
    if (!first) {
      return null;
    }
    baseFrom = first.on;
    baseTo = shiftDayKey(first.on, BUILD_UP_AVERAGE_DAYS - 1);
    baseAvg = meanBetween(sorted, baseFrom, baseTo);
  }
  if (baseAvg == null || baseTo >= endFrom) {
    return null;
  }
  return endAvg - baseAvg;
}

export function circumferenceDelta(
  values: readonly DatedValue[],
  startKey: string,
  todayKey: string,
): number | null {
  const sorted = valid(values);
  const inWindow = sorted.filter((entry) => entry.on >= startKey && entry.on <= todayKey);
  const end = inWindow[inWindow.length - 1];
  if (!end) {
    return null;
  }
  const lookbackFrom = shiftDayKey(startKey, -BUILD_UP_BASELINE_LOOKBACK_DAYS);
  const before = sorted.filter((entry) => entry.on >= lookbackFrom && entry.on < startKey);
  const baseline = before[before.length - 1] ?? inWindow[0]!;
  if (baseline.on >= end.on) {
    return null;
  }
  return end.value - baseline.value;
}

export function exerciseGains(params: {
  sessions: readonly BuildUpSession[];
  beforeBests: Readonly<Record<string, number>>;
  startKey: string;
  todayKey: string;
}): BuildUpExerciseGain[] {
  const stats = new Map<
    string,
    { name: string; kind: ExerciseKind; sets: number; best: number }
  >();
  for (const session of params.sessions) {
    if (session.loggedOn < params.startKey || session.loggedOn > params.todayKey) {
      continue;
    }
    for (const set of session.sets) {
      if (set.exerciseId == null) {
        continue;
      }
      const value = setPerformanceValue(set);
      if (value == null) {
        continue;
      }
      const prev = stats.get(set.exerciseId);
      if (prev) {
        prev.sets += 1;
        prev.best = Math.max(prev.best, value);
      } else {
        stats.set(set.exerciseId, {
          name: set.exerciseName,
          kind: set.kind,
          sets: 1,
          best: value,
        });
      }
    }
  }

  const main = [...stats.entries()]
    .sort((a, b) => b[1].sets - a[1].sets || a[1].name.localeCompare(b[1].name))
    .slice(0, BUILD_UP_MAIN_EXERCISES);

  const gains: BuildUpExerciseGain[] = [];
  for (const [exerciseId, stat] of main) {
    const previous = params.beforeBests[exerciseId];
    if (previous == null || !(previous > 0) || !(stat.best > previous)) {
      continue;
    }
    gains.push({
      exerciseId,
      exerciseName: stat.name,
      kind: stat.kind,
      delta: stat.best - previous,
    });
  }
  return gains;
}

export function computeBuildUp(input: BuildUpInput): BuildUpSummary {
  const startKey = buildUpStartKey(input.todayKey, input.weeks);
  const levelUps = input.progressionEvents.filter(
    (event) =>
      event.kind === 'variant_up' &&
      event.status === 'accepted' &&
      event.day >= startKey &&
      event.day <= input.todayKey,
  ).length;

  return {
    startKey,
    weightDeltaKg: weightAverageDelta(input.weightKg, startKey, input.todayKey),
    waistDeltaCm: circumferenceDelta(input.waistCm, startKey, input.todayKey),
    chestDeltaCm: circumferenceDelta(input.chestCm, startKey, input.todayKey),
    armDeltaCm: circumferenceDelta(input.armCm, startKey, input.todayKey),
    levelUps,
    exerciseGains: exerciseGains({
      sessions: input.sessions,
      beforeBests: input.beforeBests,
      startKey,
      todayKey: input.todayKey,
    }),
  };
}

export type BuildUpTranslate = (key: string, options?: Record<string, unknown>) => string;

const LBS_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;

function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function signed(value: number, locale: string, unit: string): string {
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatNumber(Math.abs(value), locale)} ${unit}`;
}

/** Metric: 0.1 kg. Imperial: 0.1 lb. */
export function formatWeightDelta(
  deltaKg: number,
  unitSystem: UnitSystem,
  locale: string,
  t: BuildUpTranslate,
): string {
  if (unitSystem === 'imperial') {
    const lbs = Math.round(deltaKg * LBS_PER_KG * 10) / 10;
    return signed(lbs, locale, t('measurements.units.lbs'));
  }
  return signed(Math.round(deltaKg * 10) / 10, locale, t('measurements.units.kg'));
}

/** Metric: nearest 0.5 cm. Imperial: 0.1 in. */
export function formatCircumferenceDelta(
  deltaCm: number,
  unitSystem: UnitSystem,
  locale: string,
  t: BuildUpTranslate,
): string {
  if (unitSystem === 'imperial') {
    const inches = Math.round((deltaCm / CM_PER_INCH) * 10) / 10;
    return signed(inches, locale, t('measurements.units.in'));
  }
  return signed(Math.round(deltaCm * 2) / 2, locale, t('measurements.units.cm'));
}

function circumferencePart(
  key: 'waist' | 'chest' | 'arm',
  deltaCm: number | null,
  unitSystem: UnitSystem,
  locale: string,
  t: BuildUpTranslate,
): string | null {
  if (deltaCm == null) {
    return null;
  }
  if (Math.abs(deltaCm) < BUILD_UP_CIRCUMFERENCE_STABLE_CM) {
    return t(`measurements.buildUp.${key}Stable`);
  }
  return t(`measurements.buildUp.${key}Delta`, {
    delta: formatCircumferenceDelta(deltaCm, unitSystem, locale, t),
  });
}

/** Sentence parts in fixed order; parts without data are left out. */
export function buildUpParts(
  summary: BuildUpSummary,
  options: { unitSystem: UnitSystem; locale: string; t: BuildUpTranslate },
): string[] {
  const { unitSystem, locale, t } = options;
  const parts: string[] = [];

  if (summary.weightDeltaKg != null) {
    parts.push(
      Math.abs(summary.weightDeltaKg) < BUILD_UP_WEIGHT_STABLE_KG
        ? t('measurements.buildUp.weightStable')
        : t('measurements.buildUp.weightDelta', {
            delta: formatWeightDelta(summary.weightDeltaKg, unitSystem, locale, t),
          }),
    );
  }
  for (const [key, delta] of [
    ['waist', summary.waistDeltaCm],
    ['chest', summary.chestDeltaCm],
    ['arm', summary.armDeltaCm],
  ] as const) {
    const part = circumferencePart(key, delta, unitSystem, locale, t);
    if (part) {
      parts.push(part);
    }
  }
  if (summary.levelUps > 0) {
    parts.push(t('measurements.buildUp.levelUps', { count: summary.levelUps }));
  }
  for (const gain of summary.exerciseGains.slice(0, BUILD_UP_MAX_EXERCISES_IN_SENTENCE)) {
    parts.push(
      t(gain.kind === 'time' ? 'measurements.buildUp.exerciseSeconds' : 'measurements.buildUp.exerciseReps', {
        name: gain.exerciseName,
        delta: formatNumber(gain.delta, locale),
      }),
    );
  }
  return parts;
}

/**
 * E.g. "Du baust auf: Gewicht stabil, Taille −1,5 cm, Brust +1 cm, Liegestütze +4."
 * Null when no part has data.
 */
export function formatBuildUpSentence(
  summary: BuildUpSummary,
  options: { unitSystem: UnitSystem; locale: string; t: BuildUpTranslate },
): string | null {
  const parts = buildUpParts(summary, options);
  if (parts.length === 0) {
    return null;
  }
  return options.t('measurements.buildUp.sentence', { parts: parts.join(', ') });
}

/** Today shows the build-up card for these profiles.goal_type values. */
export function isBuildUpGoal(goalType: string | null | undefined): boolean {
  return goalType === 'build_muscle' || goalType === 'gain_weight';
}
