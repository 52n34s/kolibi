import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { personalBests, setPerformanceValue, type PersonalBest } from '@/lib/workouts/progress';
import { trainingCardSessionCount } from '@/lib/workouts/week-day-markers';
import type {
  Exercise,
  ExerciseKind,
  ProgressionEvent,
  ProgressionEventKind,
  WorkoutSession,
} from '@/lib/workouts/types';

/**
 * Data behind a shareable sticker.
 *
 * Deliberately no body weight, body measurements, calorie goals or added load
 * (weightKg): a sticker ends up on social media, and none of that belongs there.
 * Exercises are always grouped by exercise_id, never by their stored name.
 */

export type StickerVariant = 'light' | 'dark';
export type StickerAction = 'save' | 'copy' | 'share';
export type StickerAnalyticsType = 'exercise' | 'level' | 'session' | 'recap_week' | 'recap_month';
export type StickerFormat = 'sticker' | 'story';
export type RecapPeriod = 'week' | 'month';

export type LadderPosition = { step: number; total: number };

/**
 * Badge on an exercise sticker. A first execution is not a personal best:
 * there is nothing to beat yet.
 */
export type ExerciseMilestone = 'newBest' | 'firstTime' | null;

export type ExerciseStickerData = {
  kind: 'exercise';
  name: string;
  exerciseKind: ExerciseKind;
  perSide: boolean;
  /** Reps (reps / weighted) or seconds (time) per completed set, in order. */
  values: number[];
  level: LadderPosition | null;
  milestone: ExerciseMilestone;
};

export type LevelStickerData = {
  kind: 'level';
  name: string;
  level: LadderPosition;
  previousName: string | null;
};

export type SessionStickerExercise = {
  name: string;
  exerciseKind: ExerciseKind;
  best: number;
};

export type SessionStickerData = {
  kind: 'session';
  name: string;
  dateKey: string;
  durationMinutes: number;
  totalReps: number;
  totalSeconds: number;
  bestsCount: number;
  levelsCount: number;
  topExercises: SessionStickerExercise[];
};

export type RecapGain = {
  name: string;
  exerciseKind: ExerciseKind;
  from: number;
  to: number;
};

export type RecapStickerData = {
  kind: 'recap';
  period: RecapPeriod;
  sessions: number;
  totalReps: number;
  bestsCount: number;
  levelsCount: number;
  biggestGain: RecapGain | null;
  /** Days on which the protein goal was hit; the line is left out at 0. */
  proteinHitDays: number;
};

export type StickerData =
  | ExerciseStickerData
  | LevelStickerData
  | SessionStickerData
  | RecapStickerData;

/** Optional lines on a sticker; each sticker reads the ones that apply to it. */
export type StickerOptions = {
  showBest: boolean;
  showLevel: boolean;
  showPrevious: boolean;
  showDate: boolean;
  showTopExercises: boolean;
  showBiggestGain: boolean;
  showProtein: boolean;
};

export const DEFAULT_STICKER_OPTIONS: StickerOptions = {
  showBest: true,
  showLevel: true,
  showPrevious: true,
  showDate: true,
  showTopExercises: true,
  showBiggestGain: true,
  showProtein: true,
};

export type StickerOptionKey = keyof StickerOptions;

/** Which switches make sense for this sticker (only where the data exists). */
export function availableStickerOptions(data: StickerData): StickerOptionKey[] {
  switch (data.kind) {
    case 'exercise':
      return [
        ...(data.values.length > 0 ? (['showBest'] as const) : []),
        ...(data.level ? (['showLevel'] as const) : []),
      ];
    case 'level':
      return data.previousName ? ['showPrevious'] : [];
    case 'session':
      return ['showDate', ...(data.topExercises.length > 0 ? (['showTopExercises'] as const) : [])];
    case 'recap':
      return [
        ...(data.biggestGain ? (['showBiggestGain'] as const) : []),
        ...(data.proteinHitDays > 0 ? (['showProtein'] as const) : []),
      ];
  }
}

export function stickerAnalyticsType(data: StickerData): StickerAnalyticsType {
  if (data.kind === 'recap') {
    return data.period === 'month' ? 'recap_month' : 'recap_week';
  }
  return data.kind;
}

function withUnit(value: number | string, kind: ExerciseKind): string {
  return kind === 'time' ? `${value} s` : String(value);
}

/**
 * "3 × 8", "8 · 8 · 7", "3 × 30 s", "30 · 30 · 25 s".
 * Weighted sets show reps only — the load never goes on a sticker.
 */
export function formatSetsCompact(values: readonly number[], kind: ExerciseKind): string {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0);
  if (clean.length === 0) {
    return '';
  }
  if (clean.length === 1) {
    return withUnit(clean[0], kind);
  }
  if (clean.every((v) => v === clean[0])) {
    return `${clean.length} × ${withUnit(clean[0], kind)}`;
  }
  return withUnit(clean.join(' · '), kind);
}

export function formatStickerValue(value: number, kind: ExerciseKind): string {
  return withUnit(value, kind);
}

export function bestOf(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0);
  return clean.length > 0 ? Math.max(...clean) : null;
}

/** "Klimmzüge 5 → 7" / "Plank 30 → 45 s". */
export function formatGain(gain: RecapGain): string {
  return `${gain.name} ${gain.from} → ${withUnit(gain.to, gain.exerciseKind)}`;
}

type LadderRow = Pick<Exercise, 'ladderKey' | 'ladderStep' | 'userId' | 'archivedAt'>;

function ladderRows<T extends LadderRow>(ladderKey: string, rows: readonly T[]): T[] {
  return rows
    .filter((row) => row.ladderKey === ladderKey && row.userId == null && row.archivedAt == null)
    .slice()
    .sort((a, b) => (a.ladderStep ?? 0) - (b.ladderStep ?? 0));
}

/**
 * Position of a catalog exercise on its ladder. `ladder` is `fetchLadder`'s
 * result or any list holding the catalog (filtered the same way here).
 */
export function ladderPosition(
  exercise: Pick<Exercise, 'ladderKey' | 'ladderStep'> | null | undefined,
  ladder: readonly LadderRow[],
): LadderPosition | null {
  if (!exercise?.ladderKey || exercise.ladderStep == null) {
    return null;
  }
  const total = ladderRows(exercise.ladderKey, ladder).length;
  if (total < 2 || exercise.ladderStep < 1 || exercise.ladderStep > total) {
    return null;
  }
  return { step: exercise.ladderStep, total };
}

/**
 * `priorBest` is the best earlier value of this exercise (null: never done).
 * Nothing is claimed while the history is still loading.
 */
export function exerciseMilestone(params: {
  sessionBest: number | null;
  priorBest: number | null;
  historyLoaded: boolean;
}): ExerciseMilestone {
  if (!params.historyLoaded || params.sessionBest == null || !(params.sessionBest > 0)) {
    return null;
  }
  if (params.priorBest == null || !(params.priorBest > 0)) {
    return 'firstTime';
  }
  return params.sessionBest > params.priorBest ? 'newBest' : null;
}

function nameOrFallback(
  exercise: Pick<Exercise, 'names'> | null | undefined,
  lang: string,
  fallback: string,
): string {
  const resolved = exercise ? resolveExerciseName(exercise, lang) : '';
  return resolved.length > 0 ? resolved : fallback.trim();
}

export function buildExerciseSticker(params: {
  exercise: Pick<Exercise, 'names' | 'ladderKey' | 'ladderStep'> | null | undefined;
  /** Stored snapshot name, used when the exercise row is not loaded. */
  fallbackName: string;
  lang: string;
  exerciseKind: ExerciseKind;
  perSide: boolean;
  values: readonly number[];
  ladder: readonly LadderRow[];
  milestone: ExerciseMilestone;
}): ExerciseStickerData {
  return {
    kind: 'exercise',
    name: nameOrFallback(params.exercise, params.lang, params.fallbackName),
    exerciseKind: params.exerciseKind,
    perSide: params.perSide,
    values: params.values.filter((v) => Number.isFinite(v) && v > 0),
    level: ladderPosition(params.exercise, params.ladder),
    milestone: params.milestone,
  };
}

/** Null when the new exercise is not on a ladder — then there is no "level". */
export function buildLevelSticker(params: {
  toExercise: Pick<Exercise, 'id' | 'names' | 'ladderKey' | 'ladderStep'> | null | undefined;
  /** The exercise the user came from (accepted suggestion row). */
  fromExercise?: Pick<Exercise, 'names'> | null;
  lang: string;
  ladder: readonly (LadderRow & Pick<Exercise, 'names'>)[];
}): LevelStickerData | null {
  const { toExercise, lang } = params;
  const level = ladderPosition(toExercise, params.ladder);
  if (!toExercise || !level) {
    return null;
  }
  const previous =
    params.fromExercise ??
    ladderRows(toExercise.ladderKey!, params.ladder).find(
      (row) => row.ladderStep === level.step - 1,
    ) ??
    null;
  const previousName = previous ? resolveExerciseName(previous, lang) : '';
  return {
    kind: 'level',
    name: resolveExerciseName(toExercise, lang),
    level,
    previousName: previousName.length > 0 ? previousName : null,
  };
}

export function buildSessionSticker(params: {
  name: string;
  dateKey: string;
  durationMinutes: number;
  totals: { reps: number; seconds: number };
  items: readonly {
    exerciseId: string;
    name: string;
    exerciseKind: ExerciseKind;
    values: readonly number[];
  }[];
  bestsCount: number;
  /** Progression suggestions shown on the summary, by item index. */
  suggestions: readonly { index: number; kind: ProgressionEventKind }[];
  /** Accepted here, written on "Fertig" — the sticker is made before that. */
  decisions: Readonly<Record<number, 'accept' | 'later'>>;
}): SessionStickerData {
  const byExercise = new Map<string, SessionStickerExercise>();
  for (const item of params.items) {
    const best = bestOf(item.values);
    if (best == null) {
      continue;
    }
    const prev = byExercise.get(item.exerciseId);
    if (!prev || best > prev.best) {
      byExercise.set(item.exerciseId, {
        name: prev?.name ?? item.name,
        exerciseKind: item.exerciseKind,
        best,
      });
    }
  }
  return {
    kind: 'session',
    name: params.name.trim(),
    dateKey: params.dateKey,
    durationMinutes: Math.max(1, Math.round(params.durationMinutes)),
    totalReps: params.totals.reps,
    totalSeconds: params.totals.seconds,
    bestsCount: params.bestsCount,
    levelsCount: params.suggestions.filter(
      (row) => row.kind === 'variant_up' && params.decisions[row.index] === 'accept',
    ).length,
    topExercises: topSessionExercises([...byExercise.values()]),
  };
}

/**
 * Values of one exercise in the session where its best set happened.
 * Matched by exercise_id only.
 */
export function bestSessionSets(
  sessions: readonly WorkoutSession[],
  best: Pick<PersonalBest, 'exerciseId' | 'completedAt'>,
): { values: number[]; perSide: boolean } {
  if (best.exerciseId == null) {
    return { values: [], perSide: false };
  }
  const session = sessions.find((row) =>
    row.sets.some(
      (set) => set.exerciseId === best.exerciseId && set.completedAt === best.completedAt,
    ),
  );
  const sets = (session?.sets ?? [])
    .filter((set) => set.exerciseId === best.exerciseId)
    .slice()
    .sort((a, b) => a.setIndex - b.setIndex);
  return {
    values: sets.map(setPerformanceValue).filter((v): v is number => v != null && v > 0),
    perSide: sets.some((set) => set.perSide),
  };
}

/** Accepted level-ups (`variant_up`) — the only events that are a "Neue Stufe". */
export function acceptedLevelUps(events: readonly ProgressionEvent[]): ProgressionEvent[] {
  return events.filter((ev) => ev.status === 'accepted' && ev.kind === 'variant_up');
}

/**
 * Largest relative gain among personal bests; ties go to the larger absolute
 * step. Relative, so 30 → 45 s does not drown out 5 → 7 reps by unit alone.
 */
export function biggestGain(
  bests: readonly Pick<PersonalBest, 'exerciseName' | 'kind' | 'value' | 'previousValue'>[],
): RecapGain | null {
  let pick: RecapGain | null = null;
  let pickRatio = 0;
  for (const best of bests) {
    if (!(best.previousValue > 0) || !(best.value > best.previousValue)) {
      continue;
    }
    const ratio = best.value / best.previousValue;
    const delta = best.value - best.previousValue;
    if (pick == null || ratio > pickRatio || (ratio === pickRatio && delta > pick.to - pick.from)) {
      pick = {
        name: best.exerciseName,
        exerciseKind: best.kind,
        from: best.previousValue,
        to: best.value,
      };
      pickRatio = ratio;
    }
  }
  return pick;
}

export function buildRecapSticker(
  period: RecapPeriod,
  params: {
    /** Workout sessions inside the period (reps and bests come from these). */
    sessions: readonly WorkoutSession[];
    /**
     * The inputs of the sessions card on the progress tab. "Einheiten" is its
     * number: training days, manual sessions and workouts merged.
     */
    card: {
      rangeStartKey: string;
      todayKey: string;
      manualSessions: readonly { loggedOn: string }[];
      workoutSessions: readonly { loggedOn: string }[];
    };
    /** Best value per exercise_id before the period (`useExerciseBestsBefore`). */
    beforeBests: Readonly<Record<string, number>>;
    /** Progression events since the period start. */
    events: readonly ProgressionEvent[];
    /** `summary.proteinHitDays` of the progress tab. */
    proteinHitDays: number;
    /** Localized display name for a best (catalog names follow the app language). */
    nameOf: (best: PersonalBest) => string;
  },
): RecapStickerData {
  const sets = params.sessions.flatMap((session) => session.sets);
  let totalReps = 0;
  for (const set of sets) {
    if (set.kind !== 'time' && set.reps != null && set.reps > 0) {
      totalReps += set.reps;
    }
  }
  // personalBests groups by exercise_id and skips sets without one.
  const bests = personalBests(sets, params.beforeBests).map((best) => ({
    ...best,
    exerciseName: params.nameOf(best),
  }));
  return {
    kind: 'recap',
    period,
    sessions: trainingCardSessionCount({
      rangeDays: period === 'month' ? 30 : 7,
      ...params.card,
    }),
    totalReps,
    bestsCount: bests.length,
    levelsCount: acceptedLevelUps(params.events).length,
    biggestGain: biggestGain(bests),
    proteinHitDays: Math.max(0, Math.floor(params.proteinHitDays)),
  };
}

/** Top three exercises by best set, reps before time (a 60 s plank is not "60"). */
export function topSessionExercises(
  rows: readonly SessionStickerExercise[],
  limit = 3,
): SessionStickerExercise[] {
  return rows
    .filter((row) => row.best > 0)
    .slice()
    .sort((a, b) => {
      const aTime = a.exerciseKind === 'time' ? 1 : 0;
      const bTime = b.exerciseKind === 'time' ? 1 : 0;
      return aTime - bTime || b.best - a.best;
    })
    .slice(0, limit);
}
