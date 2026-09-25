import type { ReadinessLevel } from '../checkin/readiness';
import type { TodayCheckinStatus } from '../checkin/checkin-status';
import { CHECKIN_CARD_UNTIL_HOUR } from '../checkin/checkin-status';
import { focusAreaBoost, type FocusAreaId } from '../focus-areas';
import type { GoalCategory } from '../goal-category';
import { goalFocusFor, type RecommendationFocus } from '../goal-focus';
import { postTrainingNutritionHint } from '../nutrition/post-training-nutrition-hint';

/**
 * Recommendations on the Today tab (Block 3.3). Fixed rules, no model.
 *
 * Every threshold lives in RECOMMENDATION_RULES so tests and the report point
 * at the same numbers. Missing inputs (null / undefined) simply mean the rule
 * that needs them stays quiet.
 */

export type RecommendationKind =
  | 'protein'
  | 'fiber'
  | 'carbs_training'
  | 'post_training'
  | 'next_level'
  | 'muscle_deficit'
  | 'rest_day'
  | 'deload'
  | 'weight'
  | 'measurements'
  | 'checkin';

export type RecommendationCategory = 'nutrition' | 'training' | 'data';

export type RecommendationText = {
  key: string;
  params?: Record<string, string | number>;
};

/** Where the action leads; the screen maps each target to a handler. */
export type RecommendationTarget =
  | { target: 'meals' }
  | { target: 'weightSheet' }
  | { target: 'measurementsSheet' }
  | { target: 'exerciseProgress'; exerciseId: string }
  | { target: 'training' }
  | { target: 'checkin' }
  | { target: 'deloadStart' }
  | { target: 'deloadDismiss' };

export type RecommendationTargetName = RecommendationTarget['target'];

export type RecommendationAction = RecommendationTarget & { labelKey: string };

export type Recommendation = {
  kind: RecommendationKind;
  category: RecommendationCategory;
  /** Ionicons glyph name. */
  icon: string;
  /** The one sentence. */
  message: RecommendationText;
  /** Further sentences under it (the post-training macro lines). */
  moreLines?: RecommendationText[];
  /** Optional goal-specific reason (from the goal-focus table). */
  reason: RecommendationText | null;
  action: RecommendationAction;
  /** A second choice next to the action ("Jetzt nicht" for the lighter week). */
  secondaryAction?: RecommendationAction;
};

export type MacroAmounts = {
  proteinG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  /** Only the post-training hint reads fat; undefined counts as unknown. */
  fatG?: number | null;
};

export type MacroTargets = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  fatG?: number | null;
};

export type MuscleDeficit = {
  /** Muscle group key (muscles.groups.*). */
  group: string;
  /** Display name of the group, already translated. */
  groupName: string;
  /** Sets still missing this week. */
  setsToAdd: number;
  exerciseId: string;
  exerciseName: string;
};

export type NextLevelReady = {
  exerciseId: string;
  exerciseName: string;
};

export type RecommendationContext = {
  goalCategory: GoalCategory | null;
  /** Local time of day. */
  hour: number;
  minute: number;
  /** Local date key YYYY-MM-DD. */
  todayKey: string;
  /** Epoch ms, for the snooze window. */
  nowMs: number;
  /** A unit is planned today (weekdays) or a session was logged today. */
  trainingDay: boolean;
  /** A session was already logged today. */
  trainedToday: boolean;
  /** What today's session was: a unit / strength row, or a run / cardio. null = nothing today. */
  trainedTodayKind: 'strength' | 'endurance' | null;
  /** Hours since that session ended; null when the time is unknown. */
  hoursSinceTraining: number | null;
  /** The chosen focus areas; they pull their topics forward in the ranking. */
  focusAreas: readonly FocusAreaId[] | null;
  /** suggestDeload said yes (see deload.ts) — the lighter week is worth offering. */
  deloadSuggested: boolean;
  /** Consumed so far today; null per macro = unknown. */
  consumed: MacroAmounts | null;
  targets: MacroTargets | null;
  /** Readiness level; null = no readiness (unavailable or still loading). */
  readiness: ReadinessLevel | null;
  /** First exercise of the next unit that is ready for the next level. */
  nextLevel: NextLevelReady | null;
  muscleDeficits: readonly MuscleDeficit[];
  /**
   * Local date key of the latest weigh-in. null = never weighed,
   * undefined = unknown (still loading / failed) → no weight hint.
   */
  lastWeightDateKey: string | null | undefined;
  /** Local date key of the latest body measurement; null = none. */
  lastMeasurementDateKey: string | null | undefined;
  usesMeasurements: boolean;
  checkinStatus: TodayCheckinStatus | null;
  /** kind → ISO timestamp of the last dismissal. */
  dismissals: Partial<Record<RecommendationKind, string>>;
};

export const RECOMMENDATION_RULES = {
  /** At most this many cards at a time. */
  maxShown: 3,
  /** A dismissed kind comes back after 3 days (72 h). */
  snoozeMs: 3 * 24 * 60 * 60 * 1000,
  /** Expected share of the day target: 0 % until 08:00 … */
  curveStartMinutes: 8 * 60,
  /** … rising linearly to 100 % at 21:00. */
  curveEndMinutes: 21 * 60,
  /** Nutrition hints start at 10:00. */
  nutritionFromMinutes: 10 * 60,
  /** "Clearly below": consumed < 80 % of the expected share. */
  clearlyBelowRatio: 0.8,
  /** Smallest gap to the day target worth a hint (grams). */
  minRemainingG: { protein: 15, fiber: 5, carbs: 30 },
  /** Smallest weekly set gap per muscle group worth a hint. */
  minMuscleDeficitSets: 3,
  /** The post-training hint stays on Today for this long after the session. */
  postTrainingWindowHours: 4,
  /** Weight hint after this many days without a weigh-in. */
  weightStaleDays: 7,
  /** Measurement hint after this many days without a measurement. */
  measurementStaleDays: 14,
  /** Check-in hint from 12:00 on — before that the check-in card itself shows. */
  checkinFromHour: CHECKIN_CARD_UNTIL_HOUR,
} as const;

/** Goals whose progress is read on the scale (gain_weight → muscle). */
export const WEIGHT_REFERENCE_GOALS: ReadonlySet<GoalCategory> = new Set<GoalCategory>([
  'lose',
  'muscle',
  'maintain',
]);

/** Goals that get the training-day carbs hint (their focus table has a carbs topic). */
const CARBS_FOCUS: ReadonlySet<RecommendationFocus> = new Set<RecommendationFocus>([
  'carbs_around_training',
  'carbs_before_training',
  'carbs_on_run_days',
]);

const CATEGORY_ORDER: Record<RecommendationCategory, number> = {
  nutrition: 0,
  training: 1,
  data: 2,
};

const K = 'recommendations';

/** 0 … 1: share of the day target expected by this time. */
export function expectedDayShare(hour: number, minute: number): number {
  const minutes = hour * 60 + minute;
  const { curveStartMinutes, curveEndMinutes } = RECOMMENDATION_RULES;
  if (minutes <= curveStartMinutes) {
    return 0;
  }
  if (minutes >= curveEndMinutes) {
    return 1;
  }
  return (minutes - curveStartMinutes) / (curveEndMinutes - curveStartMinutes);
}

/**
 * Grams still missing to the day target when the intake is clearly behind the
 * time curve; null when no hint is due.
 */
export function macroGap(params: {
  consumed: number | null | undefined;
  target: number | null | undefined;
  hour: number;
  minute: number;
  minRemaining: number;
}): number | null {
  const { consumed, target } = params;
  if (consumed == null || !Number.isFinite(consumed) || consumed < 0) {
    return null;
  }
  if (target == null || !Number.isFinite(target) || target <= 0) {
    return null;
  }
  if (params.hour * 60 + params.minute < RECOMMENDATION_RULES.nutritionFromMinutes) {
    return null;
  }
  const expected = target * expectedDayShare(params.hour, params.minute);
  if (!(consumed < expected * RECOMMENDATION_RULES.clearlyBelowRatio)) {
    return null;
  }
  const remaining = Math.round(target - consumed);
  return remaining >= params.minRemaining ? remaining : null;
}

/** Whole days between two YYYY-MM-DD keys (later − earlier). */
export function daysBetweenKeys(fromKey: string, toKey: string): number | null {
  const parse = (key: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    return match
      ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000
      : null;
  };
  const from = parse(fromKey);
  const to = parse(toKey);
  return from == null || to == null ? null : to - from;
}

export function isSnoozed(
  dismissedAt: string | undefined,
  nowMs: number,
): boolean {
  if (!dismissedAt) {
    return false;
  }
  const at = Date.parse(dismissedAt);
  if (!Number.isFinite(at)) {
    return false;
  }
  return nowMs - at < RECOMMENDATION_RULES.snoozeMs;
}

function focusIndex(goal: GoalCategory | null, focus: RecommendationFocus): number {
  const index = goalFocusFor(goal).findIndex((entry) => entry.focus === focus);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function reasonFor(goal: GoalCategory | null, focus: RecommendationFocus): RecommendationText | null {
  const entry = goalFocusFor(goal).find((item) => item.focus === focus);
  return entry ? { key: entry.reasonKey } : null;
}

function hasFocus(goal: GoalCategory | null, focus: RecommendationFocus): boolean {
  return goalFocusFor(goal).some((entry) => entry.focus === focus);
}

type Ranked = Recommendation & { rank: number; focus?: RecommendationFocus };

/**
 * The hint right after the session, on Today for the next few hours: the same
 * lines the summary showed (post-training-nutrition-hint), so both say the
 * same thing. It replaces the plain protein / carbs hints — same macros, and
 * this copy says why they matter now.
 */
function postTraining(ctx: RecommendationContext): Ranked | null {
  const { consumed, targets, trainedTodayKind, hoursSinceTraining } = ctx;
  if (!consumed || !targets || trainedTodayKind == null) {
    return null;
  }
  if (
    hoursSinceTraining == null ||
    hoursSinceTraining < 0 ||
    hoursSinceTraining > RECOMMENDATION_RULES.postTrainingWindowHours
  ) {
    return null;
  }
  const lines = postTrainingNutritionHint({
    trainingKind: trainedTodayKind,
    consumed: {
      proteinG: consumed.proteinG,
      carbsG: consumed.carbsG,
      fatG: consumed.fatG ?? null,
    },
    targets: {
      proteinG: targets.proteinG,
      carbsG: targets.carbsG,
      fatG: targets.fatG ?? null,
    },
  });
  const [first, ...rest] = lines;
  if (!first) {
    return null;
  }
  return {
    kind: 'post_training',
    category: 'nutrition',
    icon: 'nutrition-outline',
    message: { key: first.messageKey, params: 'params' in first ? first.params : undefined },
    ...(rest.length > 0
      ? {
          moreLines: rest.map((line) => ({
            key: line.messageKey,
            params: 'params' in line ? line.params : undefined,
          })),
        }
      : {}),
    reason: null,
    action: { target: 'meals', labelKey: `${K}.protein.action` },
    // Ahead of the day hints: the window is short and the moment is now.
    rank: -1,
  };
}

function nutrition(ctx: RecommendationContext): Ranked[] {
  const out: Ranked[] = [];
  const { consumed, targets, goalCategory: goal, hour, minute } = ctx;
  if (!consumed || !targets) {
    return out;
  }
  const minRemaining = RECOMMENDATION_RULES.minRemainingG;

  // Protein is part of every goal; without a goal it still counts.
  const protein = macroGap({
    consumed: consumed.proteinG,
    target: targets.proteinG,
    hour,
    minute,
    minRemaining: minRemaining.protein,
  });
  if (protein != null) {
    out.push({
      kind: 'protein',
      category: 'nutrition',
      icon: 'egg-outline',
      message: { key: `${K}.protein.message`, params: { grams: protein } },
      reason: reasonFor(goal, 'protein'),
      action: { target: 'meals', labelKey: `${K}.protein.action` },
      rank: focusIndex(goal, 'protein'),
    });
  }

  if (hasFocus(goal, 'fiber')) {
    const fiber = macroGap({
      consumed: consumed.fiberG,
      target: targets.fiberG,
      hour,
      minute,
      minRemaining: minRemaining.fiber,
    });
    if (fiber != null) {
      out.push({
        kind: 'fiber',
        category: 'nutrition',
        icon: 'leaf-outline',
        message: { key: `${K}.fiber.message`, params: { grams: fiber } },
        reason: reasonFor(goal, 'fiber'),
        action: { target: 'meals', labelKey: `${K}.fiber.action` },
        rank: focusIndex(goal, 'fiber'),
      });
    }
  }

  const carbsFocus = goalFocusFor(goal).find((entry) => CARBS_FOCUS.has(entry.focus));
  if (carbsFocus && ctx.trainingDay && !ctx.trainedToday) {
    const carbs = macroGap({
      consumed: consumed.carbsG,
      target: targets.carbsG,
      hour,
      minute,
      minRemaining: minRemaining.carbs,
    });
    if (carbs != null) {
      out.push({
        kind: 'carbs_training',
        category: 'nutrition',
        icon: 'flash-outline',
        message: { key: `${K}.carbs.message` },
        reason: { key: carbsFocus.reasonKey },
        action: { target: 'meals', labelKey: `${K}.carbs.action` },
        rank: focusIndex(goal, carbsFocus.focus),
        focus: carbsFocus.focus,
      });
    }
  }

  const post = postTraining(ctx);
  if (post == null) {
    return out;
  }
  // The same two macros, said at the better moment: the day hints step aside.
  return [post, ...out.filter((rec) => rec.kind !== 'protein' && rec.kind !== 'carbs_training')];
}

function training(ctx: RecommendationContext): Ranked[] {
  const out: Ranked[] = [];
  const goal = ctx.goalCategory;

  // The lighter week comes before everything else this tab offers, and it also
  // shows on a gentle day — that is part of what asked for it.
  if (ctx.deloadSuggested) {
    out.push({
      kind: 'deload',
      category: 'training',
      icon: 'battery-half-outline',
      message: { key: `${K}.deload.message` },
      reason: reasonFor(goal, 'recovery'),
      action: { target: 'deloadStart', labelKey: `${K}.deload.actionStart` },
      secondaryAction: { target: 'deloadDismiss', labelKey: `${K}.deload.actionDismiss` },
      rank: -1,
    });
  }

  // A gentle day on a planned training day: rest fits better than more load,
  // so level-ups and extra sets wait.
  if (ctx.readiness === 'gentle') {
    if (ctx.trainingDay && !ctx.trainedToday) {
      out.push({
        kind: 'rest_day',
        category: 'training',
        icon: 'bed-outline',
        message: { key: `${K}.restDay.message` },
        reason: reasonFor(goal, 'recovery'),
        action: { target: 'training', labelKey: `${K}.restDay.action` },
        rank: 0,
      });
    }
    return out;
  }

  if (ctx.nextLevel) {
    out.push({
      kind: 'next_level',
      category: 'training',
      icon: 'trending-up-outline',
      message: { key: `${K}.nextLevel.message`, params: { exercise: ctx.nextLevel.exerciseName } },
      reason: null,
      action: {
        target: 'exerciseProgress',
        exerciseId: ctx.nextLevel.exerciseId,
        labelKey: `${K}.nextLevel.action`,
      },
      rank: 1,
    });
  }

  const deficit = [...ctx.muscleDeficits]
    .filter((row) => row.setsToAdd >= RECOMMENDATION_RULES.minMuscleDeficitSets)
    .sort((a, b) => b.setsToAdd - a.setsToAdd)[0];
  if (deficit) {
    out.push({
      kind: 'muscle_deficit',
      category: 'training',
      icon: 'body-outline',
      message: {
        key: `${K}.muscleDeficit.message`,
        params: { group: deficit.groupName, count: deficit.setsToAdd, exercise: deficit.exerciseName },
      },
      reason: reasonFor(goal, 'sets_per_muscle') ?? reasonFor(goal, 'strength_training'),
      action: {
        target: 'exerciseProgress',
        exerciseId: deficit.exerciseId,
        labelKey: `${K}.muscleDeficit.action`,
      },
      rank: 2,
    });
  }
  return out;
}

function data(ctx: RecommendationContext): Ranked[] {
  const out: Ranked[] = [];

  if (ctx.goalCategory != null && WEIGHT_REFERENCE_GOALS.has(ctx.goalCategory)) {
    const last = ctx.lastWeightDateKey;
    const days = last === undefined ? null : last === null ? Infinity : daysBetweenKeys(last, ctx.todayKey);
    if (days != null && days >= RECOMMENDATION_RULES.weightStaleDays) {
      out.push({
        kind: 'weight',
        category: 'data',
        icon: 'scale-outline',
        message: { key: last == null ? `${K}.weight.messageFirst` : `${K}.weight.message` },
        reason: null,
        action: { target: 'weightSheet', labelKey: `${K}.weight.action` },
        rank: 0,
      });
    }
  }

  if (ctx.usesMeasurements && ctx.lastMeasurementDateKey) {
    const days = daysBetweenKeys(ctx.lastMeasurementDateKey, ctx.todayKey);
    if (days != null && days >= RECOMMENDATION_RULES.measurementStaleDays) {
      out.push({
        kind: 'measurements',
        category: 'data',
        icon: 'resize-outline',
        message: { key: `${K}.measurements.message` },
        reason: null,
        action: { target: 'measurementsSheet', labelKey: `${K}.measurements.action` },
        rank: 1,
      });
    }
  }

  if (ctx.checkinStatus === 'open' && ctx.hour >= RECOMMENDATION_RULES.checkinFromHour) {
    out.push({
      kind: 'checkin',
      category: 'data',
      icon: 'sunny-outline',
      message: { key: `${K}.checkin.message` },
      // Shown as the text line under the title.
      reason: { key: `${K}.checkin.body` },
      action: { target: 'checkin', labelKey: `${K}.checkin.action` },
      rank: 2,
    });
  }
  return out;
}

/**
 * Up to three recommendations: nutrition, then training, then data. Within
 * nutrition the goal's focus order decides, and a chosen focus area pulls its
 * topics forward; dismissed kinds stay away for three days.
 */
export function buildRecommendations(ctx: RecommendationContext): Recommendation[] {
  const boost = focusAreaBoost(ctx.focusAreas);
  // One step per recommendation, never two: a topic that matches twice still
  // moves by the same amount (see focus-areas.ts).
  const rankOf = (rec: Ranked) =>
    rec.rank + (boost[rec.kind] ?? (rec.focus != null ? (boost[rec.focus] ?? 0) : 0));
  const all = [...nutrition(ctx), ...training(ctx), ...data(ctx)].filter(
    (rec) => !isSnoozed(ctx.dismissals[rec.kind], ctx.nowMs),
  );
  all.sort(
    (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || rankOf(a) - rankOf(b),
  );
  return all
    .slice(0, RECOMMENDATION_RULES.maxShown)
    .map(({ rank: _rank, focus: _focus, ...rec }) => rec);
}

/**
 * Training day for the recommendations. With weekdays: a unit is planned
 * today. In a rotating plan (units without weekdays, e.g. from the plan
 * wizard): the week's goal is still open, so today can be a training day.
 * A session logged today always makes it one.
 */
export function isTrainingDay(params: {
  units: readonly { weekdays: readonly number[] }[];
  sessionDays: readonly string[];
  todayKey: string;
  weekday: number;
  weekStartKey: string;
  sessionsPerWeek: number | null;
}): boolean {
  if (params.sessionDays.includes(params.todayKey)) {
    return true;
  }
  if (params.units.some((unit) => unit.weekdays.includes(params.weekday))) {
    return true;
  }
  const rotating = params.units.length > 0 && params.units.every((unit) => unit.weekdays.length === 0);
  if (!rotating) {
    return false;
  }
  const goal = params.sessionsPerWeek != null && params.sessionsPerWeek > 0 ? params.sessionsPerWeek : params.units.length;
  const doneThisWeek = new Set(
    params.sessionDays.filter((day) => day >= params.weekStartKey && day <= params.todayKey),
  ).size;
  return doneThisWeek < goal;
}
