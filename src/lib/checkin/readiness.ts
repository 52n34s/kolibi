import type { ExerciseKind, GymIntensity } from '@/lib/workouts/types';

/**
 * Daily readiness from the morning check-in and the data Kolibi already has
 * (training load, last session, nutrition). Fixed rules, no model.
 *
 * Every threshold lives in READINESS_RULES so tests and the report point at
 * the same numbers.
 */

/** 1 = low … 5 = high. Soreness 5 = very sore, stress 5 = very stressed. */
export type CheckinAnswers = {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
};

export type DailyCheckin = CheckinAnswers & {
  /** Local date key YYYY-MM-DD. */
  date: string;
};

/** bereit · normal · schonen */
export type ReadinessLevel = 'ready' | 'normal' | 'gentle';

/**
 * checkin: today's answers were used.
 * data: no check-in today, rated from training / nutrition data only.
 * none: neither — the result is a neutral "normal" and changes nothing.
 */
export type ReadinessBasis = 'checkin' | 'data' | 'none';

export type CheckinRating = 'good' | 'neutral' | 'low';

export type ReadinessSignal =
  | 'lowCheckin'
  | 'soreHigh'
  | 'highLoad'
  | 'performanceDrop'
  | 'lowCalories'
  | 'lowProtein';

export type ReadinessSet = {
  exerciseId: string | null;
  kind: ExerciseKind;
  perSide: boolean;
  reps: number | null;
  seconds: number | null;
  secondsOtherSide: number | null;
  weightKg: number | null;
};

export type ReadinessSession = {
  id: string;
  loggedOn: string;
  startedAt: string;
  finishedAt: string | null;
  intensity: GymIntensity | null;
  sets: readonly ReadinessSet[];
};

export type ReadinessNutritionDay = {
  date: string;
  /** null = nothing logged that day (the day is skipped, never counted as "under"). */
  calories: number | null;
  calorieTarget: number | null;
  proteinG: number | null;
  proteinTargetG: number | null;
};

export type ReadinessUnit = {
  id: string;
  name: string;
  muscles: readonly string[];
};

export type ReadinessInput = {
  todayKey: string;
  /** Today's answers; null when not (yet) answered. */
  checkin: CheckinAnswers | null;
  /** Earlier check-ins (any order); entries on or after todayKey are ignored. */
  pastCheckins: readonly DailyCheckin[];
  sessions: readonly ReadinessSession[];
  nutrition?: readonly ReadinessNutritionDay[];
  /**
   * Muscle profile of the unit planned next (from the muscle-profile block).
   * Optional: without it soreness only gives a general hint.
   */
  plannedUnit?: ReadinessUnit | null;
  alternativeUnits?: readonly ReadinessUnit[];
  /** Muscles worked in the last days — where the soreness most likely sits. */
  soreMuscles?: readonly string[];
};

export type ReadinessText = {
  key: string;
  params?: Record<string, string | number>;
};

export type ReadinessResult = {
  level: ReadinessLevel;
  basis: ReadinessBasis;
  /** Fewer than CHECKIN_BASELINE_MIN earlier check-ins: absolute rating + "Kolibi lernt dich noch kennen". */
  learning: boolean;
  checkinRating: CheckinRating | null;
  /** sleep + energy + (6 − soreness) + (6 − stress), 4 … 20. */
  wellness: number | null;
  /** Mean wellness of the last CHECKIN_BASELINE_WINDOW check-ins, when there are enough. */
  baseline: number | null;
  signals: ReadinessSignal[];
  load3: number;
  load7: number;
  /** The one sentence … */
  message: ReadinessText;
  /** … and the one action. */
  action: ReadinessText;
  /** A unit from alternativeUnits that spares the sore muscles. */
  alternativeUnitId: string | null;
  /** First sore muscle the planned unit would work again. */
  soreMuscle: string | null;
};

export const READINESS_RULES = {
  /** Baseline = mean of the last 14 check-ins before today … */
  baselineWindow: 14,
  /** … used once there are at least 7; below that the rating is absolute. */
  baselineMin: 7,
  /** Wellness ≥ baseline + 2 → good. */
  relativeGoodDelta: 2,
  /** Wellness ≤ baseline − 3 → low. */
  relativeLowDelta: 3,
  /** Absolute rating (learning phase): ≥ 15 good, ≤ 10 low (scale 4 … 20). */
  absoluteGood: 15,
  absoluteLow: 10,
  /** Sleep or energy at 1 is always a low day. */
  redFlagValue: 1,
  /** Soreness at 4 or 5 counts as high. */
  sorenessHigh: 4,
  /** Session load = minutes × intensity weight (session-RPE style). */
  intensityWeight: { easy: 3, normal: 5, hard: 7 } as Record<GymIntensity, number>,
  /** Unknown intensity counts as normal. */
  intensityWeightUnknown: 5,
  /** Plausible session length from timestamps; outside → estimate from sets. */
  minSessionMinutes: 5,
  maxSessionMinutes: 150,
  /** Estimate when timestamps are missing or implausible. */
  minutesPerSet: 3,
  /** Load of today and the two days before ≥ 900 (≈ three normal 60-minute units) → high. */
  load3High: 900,
  /** Load of the last 7 days ≥ 1800 (≈ six normal 60-minute units) → high. */
  load7High: 1800,
  /** Last session is only judged when it is at most this many days old. */
  performanceMaxAgeDays: 7,
  /** Previous sessions with the same exercise needed for the comparison. */
  performanceCompareSessions: 3,
  /** Mean per set below 90 % of the previous three sessions' mean → drop. */
  performanceDropRatio: 0.9,
  /** Nutrition: look at the 3 days before today … */
  nutritionWindowDays: 3,
  /** … a logged day is "clearly under" below 80 % of the calorie target … */
  calorieUnderRatio: 0.8,
  /** … or below 70 % of the protein target … */
  proteinUnderRatio: 0.7,
  /** … and it takes at least 2 such days. */
  nutritionMinDays: 2,
  /** Two or more data signals make it a gentle day. */
  dataSignalsForGentle: 2,
} as const;

/** Pure date-key arithmetic (no Date timezone games). */
export function shiftDateKey(dateKey: string, dayDelta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return date.toISOString().slice(0, 10);
}

export function isValidCheckinValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isCompleteCheckin(answers: Partial<CheckinAnswers> | null | undefined): answers is CheckinAnswers {
  return (
    answers != null &&
    isValidCheckinValue(answers.sleep) &&
    isValidCheckinValue(answers.energy) &&
    isValidCheckinValue(answers.soreness) &&
    isValidCheckinValue(answers.stress)
  );
}

export function wellnessScore(answers: CheckinAnswers): number {
  return answers.sleep + answers.energy + (6 - answers.soreness) + (6 - answers.stress);
}

/** Mean wellness of the last `baselineWindow` check-ins before today, or null below `baselineMin`. */
export function checkinBaseline(
  pastCheckins: readonly DailyCheckin[],
  todayKey: string,
): { baseline: number | null; count: number } {
  const recent = pastCheckins
    .filter((entry) => entry.date < todayKey && isCompleteCheckin(entry))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, READINESS_RULES.baselineWindow);
  if (recent.length < READINESS_RULES.baselineMin) {
    return { baseline: null, count: recent.length };
  }
  const sum = recent.reduce((acc, entry) => acc + wellnessScore(entry), 0);
  return { baseline: sum / recent.length, count: recent.length };
}

export function rateCheckin(answers: CheckinAnswers, baseline: number | null): CheckinRating {
  if (
    answers.sleep <= READINESS_RULES.redFlagValue ||
    answers.energy <= READINESS_RULES.redFlagValue
  ) {
    return 'low';
  }
  const score = wellnessScore(answers);
  if (baseline != null) {
    if (score >= baseline + READINESS_RULES.relativeGoodDelta) {
      return 'good';
    }
    if (score <= baseline - READINESS_RULES.relativeLowDelta) {
      return 'low';
    }
    return 'neutral';
  }
  if (score >= READINESS_RULES.absoluteGood) {
    return 'good';
  }
  if (score <= READINESS_RULES.absoluteLow) {
    return 'low';
  }
  return 'neutral';
}

function setCount(session: ReadinessSession): number {
  return session.sets.length;
}

/** Minutes from the timestamps when plausible, else sets × minutesPerSet. */
export function sessionMinutes(session: ReadinessSession): number {
  if (session.finishedAt != null) {
    const start = Date.parse(session.startedAt);
    const end = Date.parse(session.finishedAt);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const minutes = (end - start) / 60000;
      if (
        minutes >= READINESS_RULES.minSessionMinutes &&
        minutes <= READINESS_RULES.maxSessionMinutes
      ) {
        return minutes;
      }
    }
  }
  return setCount(session) * READINESS_RULES.minutesPerSet;
}

export function sessionLoad(session: ReadinessSession): number {
  const weight =
    session.intensity != null
      ? READINESS_RULES.intensityWeight[session.intensity]
      : READINESS_RULES.intensityWeightUnknown;
  return Math.round(sessionMinutes(session) * weight);
}

/** Summed load of sessions logged in [todayKey − (days − 1), todayKey]. */
export function trainingLoad(
  sessions: readonly ReadinessSession[],
  todayKey: string,
  days: number,
): number {
  const from = shiftDateKey(todayKey, -(days - 1));
  return sessions
    .filter((session) => session.loggedOn >= from && session.loggedOn <= todayKey)
    .reduce((acc, session) => acc + sessionLoad(session), 0);
}

function setValue(set: ReadinessSet): number | null {
  if (set.kind === 'time') {
    if (set.seconds == null || !Number.isFinite(set.seconds)) {
      return null;
    }
    if (set.perSide && set.secondsOtherSide != null && Number.isFinite(set.secondsOtherSide)) {
      return Math.min(set.seconds, set.secondsOtherSide);
    }
    return set.seconds;
  }
  if (set.reps == null || !Number.isFinite(set.reps)) {
    return null;
  }
  return set.reps;
}

type ExerciseStat = { meanValue: number; meanWeight: number | null };

function exerciseStat(session: ReadinessSession, exerciseId: string): ExerciseStat | null {
  const values: number[] = [];
  const weights: number[] = [];
  for (const set of session.sets) {
    if (set.exerciseId !== exerciseId) {
      continue;
    }
    const value = setValue(set);
    if (value != null) {
      values.push(value);
    }
    if (set.kind === 'weighted' && set.weightKg != null && Number.isFinite(set.weightKg)) {
      weights.push(set.weightKg);
    }
  }
  if (values.length === 0) {
    return null;
  }
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
  return { meanValue: mean(values), meanWeight: weights.length > 0 ? mean(weights) : null };
}

function newestFirst(a: ReadinessSession, b: ReadinessSession): number {
  const byDay = b.loggedOn.localeCompare(a.loggedOn);
  if (byDay !== 0) {
    return byDay;
  }
  return b.startedAt.localeCompare(a.startedAt);
}

/**
 * Exercise ids of the latest session (≤ performanceMaxAgeDays old) whose mean
 * reps (seconds for holds) per set fell below performanceDropRatio × the mean
 * of the three previous sessions with the same exercise_id. Weighted
 * exercises done with a heavier mean weight than before are left out — fewer
 * reps are expected there.
 */
export function performanceDrops(
  sessions: readonly ReadinessSession[],
  todayKey: string,
): string[] {
  const withSets = sessions.filter((session) => session.sets.length > 0).sort(newestFirst);
  const latest = withSets[0];
  if (!latest || latest.loggedOn < shiftDateKey(todayKey, -READINESS_RULES.performanceMaxAgeDays)) {
    return [];
  }
  const older = withSets.slice(1);
  const ids = [
    ...new Set(latest.sets.map((set) => set.exerciseId).filter((id): id is string => id != null)),
  ];
  const drops: string[] = [];
  for (const exerciseId of ids) {
    const now = exerciseStat(latest, exerciseId);
    if (!now) {
      continue;
    }
    const previous: ExerciseStat[] = [];
    for (const session of older) {
      const stat = exerciseStat(session, exerciseId);
      if (stat) {
        previous.push(stat);
      }
      if (previous.length >= READINESS_RULES.performanceCompareSessions) {
        break;
      }
    }
    if (previous.length < READINESS_RULES.performanceCompareSessions) {
      continue;
    }
    const avgValue = previous.reduce((acc, stat) => acc + stat.meanValue, 0) / previous.length;
    const prevWeights = previous
      .map((stat) => stat.meanWeight)
      .filter((w): w is number => w != null);
    if (now.meanWeight != null && prevWeights.length > 0) {
      const avgWeight = prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length;
      if (now.meanWeight > avgWeight) {
        continue;
      }
    }
    if (now.meanValue < avgValue * READINESS_RULES.performanceDropRatio) {
      drops.push(exerciseId);
    }
  }
  return drops;
}

/**
 * Days among the nutritionWindowDays before today with food logged and
 * calories < 80 % of the target (protein: < 70 %). Unlogged days never count.
 */
export function nutritionShortfallDays(
  nutrition: readonly ReadinessNutritionDay[],
  todayKey: string,
): { calorieDays: number; proteinDays: number } {
  const from = shiftDateKey(todayKey, -READINESS_RULES.nutritionWindowDays);
  let calorieDays = 0;
  let proteinDays = 0;
  for (const day of nutrition) {
    if (day.date < from || day.date >= todayKey) {
      continue;
    }
    if (day.calories == null || !(day.calories > 0)) {
      continue;
    }
    if (day.calorieTarget != null && day.calorieTarget > 0) {
      if (day.calories < day.calorieTarget * READINESS_RULES.calorieUnderRatio) {
        calorieDays += 1;
      }
    }
    if (day.proteinG != null && day.proteinTargetG != null && day.proteinTargetG > 0) {
      if (day.proteinG < day.proteinTargetG * READINESS_RULES.proteinUnderRatio) {
        proteinDays += 1;
      }
    }
  }
  return { calorieDays, proteinDays };
}

function hasNutritionData(nutrition: readonly ReadinessNutritionDay[], todayKey: string): boolean {
  const from = shiftDateKey(todayKey, -READINESS_RULES.nutritionWindowDays);
  return nutrition.some(
    (day) => day.date >= from && day.date < todayKey && day.calories != null && day.calories > 0,
  );
}

type SoreMatch = { muscle: string | null; alternative: ReadinessUnit | null; overlaps: boolean };

function matchSoreness(input: ReadinessInput): SoreMatch {
  const planned = input.plannedUnit;
  const sore = input.soreMuscles ?? [];
  if (!planned || planned.muscles.length === 0 || sore.length === 0) {
    return { muscle: null, alternative: null, overlaps: false };
  }
  const soreSet = new Set(sore);
  const muscle = planned.muscles.find((m) => soreSet.has(m)) ?? null;
  if (muscle == null) {
    return { muscle: null, alternative: null, overlaps: false };
  }
  const alternative =
    (input.alternativeUnits ?? []).find(
      (unit) =>
        unit.id !== planned.id &&
        unit.muscles.length > 0 &&
        unit.muscles.every((m) => !soreSet.has(m)),
    ) ?? null;
  return { muscle, alternative, overlaps: true };
}

const K = 'checkin.readiness';

function levelText(level: ReadinessLevel): { message: ReadinessText; action: ReadinessText } {
  return {
    message: { key: `${K}.${level}.sentence` },
    action: { key: `${K}.${level}.action` },
  };
}

function signalText(signal: ReadinessSignal): { message: ReadinessText; action: ReadinessText } {
  return {
    message: { key: `${K}.reason.${signal}.sentence` },
    action: { key: `${K}.reason.${signal}.action` },
  };
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { todayKey } = input;
  const checkin = isCompleteCheckin(input.checkin) ? input.checkin : null;
  const nutrition = input.nutrition ?? [];

  const load3 = trainingLoad(input.sessions, todayKey, 3);
  const load7 = trainingLoad(input.sessions, todayKey, 7);
  const highLoad = load3 >= READINESS_RULES.load3High || load7 >= READINESS_RULES.load7High;
  const drops = performanceDrops(input.sessions, todayKey);
  const { calorieDays, proteinDays } = nutritionShortfallDays(nutrition, todayKey);
  const lowCalories = calorieDays >= READINESS_RULES.nutritionMinDays;
  const lowProtein = proteinDays >= READINESS_RULES.nutritionMinDays;

  // Nutrition counts once, however many of its two rules fire.
  const dataSignals: ReadinessSignal[] = [];
  if (highLoad) {
    dataSignals.push('highLoad');
  }
  if (drops.length > 0) {
    dataSignals.push('performanceDrop');
  }
  if (lowCalories) {
    dataSignals.push('lowCalories');
  }
  if (lowProtein) {
    dataSignals.push('lowProtein');
  }
  const dataWeight =
    (highLoad ? 1 : 0) + (drops.length > 0 ? 1 : 0) + (lowCalories || lowProtein ? 1 : 0);

  const recentSessions = input.sessions.some(
    (session) => session.loggedOn >= shiftDateKey(todayKey, -6) && session.loggedOn <= todayKey,
  );

  if (checkin == null) {
    const basis: ReadinessBasis =
      recentSessions || hasNutritionData(nutrition, todayKey) ? 'data' : 'none';
    const level: ReadinessLevel =
      dataWeight >= READINESS_RULES.dataSignalsForGentle ? 'gentle' : 'normal';
    const text = dataSignals[0] ? signalText(dataSignals[0]) : levelText('normal');
    return {
      level,
      basis,
      learning: false,
      checkinRating: null,
      wellness: null,
      baseline: null,
      signals: dataSignals,
      load3,
      load7,
      ...text,
      alternativeUnitId: null,
      soreMuscle: null,
    };
  }

  const { baseline } = checkinBaseline(input.pastCheckins, todayKey);
  const rating = rateCheckin(checkin, baseline);
  const soreHigh = checkin.soreness >= READINESS_RULES.sorenessHigh;
  const sore = soreHigh ? matchSoreness(input) : { muscle: null, alternative: null, overlaps: false };

  const signals: ReadinessSignal[] = [];
  if (rating === 'low') {
    signals.push('lowCheckin');
  }
  if (soreHigh) {
    signals.push('soreHigh');
  }
  signals.push(...dataSignals);

  let level: ReadinessLevel;
  if (rating === 'low' || dataWeight >= READINESS_RULES.dataSignalsForGentle) {
    level = 'gentle';
  } else if (soreHigh && sore.overlaps) {
    level = 'gentle';
  } else if (rating === 'good' && !soreHigh && dataWeight === 0) {
    level = 'ready';
  } else {
    level = 'normal';
  }

  let text: { message: ReadinessText; action: ReadinessText };
  if (soreHigh && sore.overlaps && sore.muscle != null) {
    text = sore.alternative
      ? {
          message: { key: `${K}.sore.muscle.${sore.muscle}`, params: { muscle: sore.muscle } },
          action: {
            key: `${K}.sore.swapAction`,
            params: { alternative: sore.alternative.name, planned: input.plannedUnit?.name ?? '' },
          },
        }
      : {
          message: { key: `${K}.sore.muscle.${sore.muscle}`, params: { muscle: sore.muscle } },
          action: { key: `${K}.sore.lighterAction` },
        };
  } else if (level === 'gentle' && rating === 'low') {
    text =
      checkin.sleep <= 2
        ? { message: { key: `${K}.reason.sleep.sentence` }, action: { key: `${K}.gentle.action` } }
        : levelText('gentle');
  } else if (level === 'gentle' && dataSignals[0]) {
    text = signalText(dataSignals[0]);
  } else if (soreHigh) {
    text = { message: { key: `${K}.sore.general` }, action: { key: `${K}.sore.generalAction` } };
  } else if (level === 'normal' && dataSignals[0]) {
    text = signalText(dataSignals[0]);
  } else {
    text = levelText(level);
  }

  return {
    level,
    basis: 'checkin',
    learning: baseline == null,
    checkinRating: rating,
    wellness: wellnessScore(checkin),
    baseline,
    signals,
    load3,
    load7,
    ...text,
    alternativeUnitId: sore.alternative?.id ?? null,
    soreMuscle: sore.muscle,
  };
}
