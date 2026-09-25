import { reconcileTrainingRows } from '@/lib/training-rows';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { personalBests, setPerformanceValue, type PersonalBest } from '@/lib/workouts/progress';
import type { SkillGoalForecast, SkillGoalPeriod } from '@/lib/workouts/skill-goal-forecast';
import type {
  Exercise,
  ExerciseKind,
  ProgressionEvent,
  ProgressionEventKind,
  SessionSet,
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
export type StickerAction = 'save' | 'copy' | 'share' | 'instagram';
export type StickerAnalyticsType =
  | 'exercise'
  | 'level'
  | 'session'
  | 'recap_week'
  | 'recap_month'
  | 'progress'
  | 'meal'
  | 'goal';
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

export type ProgressPeriod = '4w' | '8w' | '12w' | 'all';

export const PROGRESS_PERIODS: readonly ProgressPeriod[] = ['4w', '8w', '12w', 'all'];

/** Weeks behind a period; "all" has no bound. */
export const PROGRESS_PERIOD_WEEKS: Record<Exclude<ProgressPeriod, 'all'>, number> = {
  '4w': 4,
  '8w': 8,
  '12w': 12,
};

/** Best set of one session. On a ladder the exercise (and step) can differ per session. */
export type ProgressPoint = {
  dateKey: string;
  value: number;
  exerciseId: string;
  exerciseName: string;
  /** Ladder step, null off-ladder. */
  step: number | null;
};

export type ProgressView = {
  period: ProgressPeriod;
  /** Chronological, one per session. */
  points: ProgressPoint[];
  start: ProgressPoint;
  current: ProgressPoint;
  /**
   * Start and current are different rungs of the ladder. Then the level is the
   * figure — reps of two different exercises are not compared.
   */
  levelChanged: boolean;
};

export type ProgressStickerData = {
  kind: 'progress';
  /** Exercise of the current rung: the shared one or, before its first set, the rung below. */
  name: string;
  exerciseKind: ExerciseKind;
  perSide: boolean;
  /** Rungs on the ladder, null off-ladder. */
  ladderTotal: number | null;
  /** Periods with at least two sessions; empty means "no sticker, show a hint". */
  views: Partial<Record<ProgressPeriod, ProgressView>>;
  /** Selected period (the default until the user switches). */
  period: ProgressPeriod;
};

/**
 * A meal right after the photo scan. The photo is only a local file URI that
 * lives while the result screen is open; it is never stored or uploaded.
 */
export type MealStickerData = {
  kind: 'meal';
  /** Ingredient labels, largest share of kcal first. */
  labels: string[];
  kcal: number;
  /** Null when no ingredient has a protein value. */
  proteinG: number | null;
  photoUri: string | null;
};

/**
 * Skill goal: exercise, target, where the user stands, a bar and the expected
 * period. Values are reps or seconds only — never the load.
 */
export type GoalStickerData = {
  kind: 'goal';
  /** The goal exercise. */
  name: string;
  exerciseKind: ExerciseKind;
  perSide: boolean;
  target: number;
  /**
   * Latest best set on the goal ladder. `name` is set when it is another rung
   * than the goal (then the value belongs to that exercise).
   */
  current: { value: number; kind: ExerciseKind; name: string | null } | null;
  /** 0…1 along the ladder up to the target. */
  progress: number;
  /** Expected period, null while there is no date to show. */
  period: SkillGoalPeriod | null;
  achieved: boolean;
  /** Rung of the goal exercise, null off-ladder. */
  level: LadderPosition | null;
};

export type StickerData =
  | ExerciseStickerData
  | LevelStickerData
  | SessionStickerData
  | RecapStickerData
  | ProgressStickerData
  | MealStickerData
  | GoalStickerData;

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
    case 'progress':
      return data.views[data.period]?.levelChanged ? ['showLevel'] : [];
    case 'meal':
      return data.proteinG != null ? ['showProtein'] : [];
    case 'goal':
      return data.level ? ['showLevel'] : [];
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

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const RECAP_PERIOD_DAYS: Record<RecapPeriod, number> = { week: 7, month: 30 };

/**
 * Rolling window of a recap: "Meine Woche" is the last 7 days including today,
 * "Mein Monat" the last 30. Every figure on the recap comes from this window.
 */
export function recapWindow(
  period: RecapPeriod,
  todayKey: string,
): { startKey: string; endKey: string } {
  const start = parseKey(todayKey);
  start.setDate(start.getDate() - (RECAP_PERIOD_DAYS[period] - 1));
  return { startKey: toKey(start), endKey: todayKey };
}

/** Local midnight of a date key as an ISO timestamp (for `since` queries). */
export function localDayStartIso(key: string): string {
  return parseKey(key).toISOString();
}

function inWindow(key: string, window: { startKey: string; endKey: string }): boolean {
  return key >= window.startKey && key <= window.endKey;
}

export function buildRecapSticker(
  period: RecapPeriod,
  params: {
    todayKey: string;
    /** Workout sessions; only those logged inside the window count. */
    workoutSessions: readonly WorkoutSession[];
    /**
     * training_sessions rows. Finishing a workout writes one and links it via
     * `trainingSessionId`; those are the workout itself and are not counted twice,
     * nor are unlinked duplicates of a unit (see reconcileTrainingRows).
     */
    manualSessions: readonly {
      id: string;
      loggedOn: string;
      activity: string;
      isManual?: boolean;
    }[];
    /** Best value per exercise_id before the window start (`useExerciseBestsBefore`). */
    beforeBests: Readonly<Record<string, number>>;
    /** Progression events; only those created inside the window count. */
    events: readonly ProgressionEvent[];
    /** One row per day with whether the protein goal was hit (today included). */
    proteinDays: readonly { date: string; hit: boolean }[];
    /** Localized display name for a best (catalog names follow the app language). */
    nameOf: (best: PersonalBest) => string;
  },
): RecapStickerData {
  const window = recapWindow(period, params.todayKey);
  const workouts = params.workoutSessions.filter((session) => inWindow(session.loggedOn, window));
  const manual = reconcileTrainingRows(params.manualSessions, params.workoutSessions).manual.filter(
    (session) => inWindow(session.loggedOn, window),
  );

  const sets = workouts.flatMap((session) => session.sets);
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
  const levelUps = acceptedLevelUps(params.events).filter((ev) =>
    inWindow(toKey(new Date(ev.createdAt)), window),
  );
  const proteinHitDays = new Set(
    params.proteinDays.filter((day) => day.hit && inWindow(day.date, window)).map((day) => day.date),
  ).size;

  return {
    kind: 'recap',
    period,
    sessions: workouts.length + manual.length,
    totalReps,
    bestsCount: bests.length,
    levelsCount: levelUps.length,
    biggestGain: biggestGain(bests),
    proteinHitDays,
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

/** Minimum sessions for a progress sticker; below that the sheet shows a hint. */
export const PROGRESS_MIN_SESSIONS = 2;
/** The default period is the longest one with at least this many sessions. */
export const PROGRESS_DEFAULT_MIN_SESSIONS = 3;

type ProgressExercise = Pick<
  Exercise,
  'id' | 'names' | 'kind' | 'perSide' | 'ladderKey' | 'ladderStep' | 'userId' | 'archivedAt'
>;

/**
 * Exercise ids a progress sticker loads: every catalog rung of the ladder,
 * or the exercise alone off-ladder. buildProgressSticker keeps the shared
 * rung and the ones below it. Load these with `fetchExerciseProgressUnits`.
 */
export function progressExerciseIds(
  exerciseId: string,
  exercises: readonly ProgressExercise[],
): string[] {
  const exercise = exercises.find((row) => row.id === exerciseId);
  if (!exercise?.ladderKey) {
    return [exerciseId];
  }
  const ids = ladderRows(exercise.ladderKey, exercises).map((row) => row.id);
  return ids.includes(exerciseId) ? ids : [...ids, exerciseId];
}

function progressWindowStart(period: ProgressPeriod, todayKey: string): string | null {
  if (period === 'all') {
    return null;
  }
  const start = parseKey(todayKey);
  start.setDate(start.getDate() - (PROGRESS_PERIOD_WEEKS[period] * 7 - 1));
  return toKey(start);
}

export function buildProgressSticker(params: {
  /** The exercise the user shares (grouped by exercise_id, never by name). */
  exerciseId: string;
  /** Exercise list holding the catalog, for names and the ladder. */
  exercises: readonly ProgressExercise[];
  /** Sessions with sets of `progressExerciseIds(...)`, any order. */
  units: readonly { sessionId: string; loggedOn: string; sets: readonly SessionSet[] }[];
  todayKey: string;
  lang: string;
}): ProgressStickerData {
  const byId = new Map(params.exercises.map((row) => [row.id, row]));
  const shared = byId.get(params.exerciseId);
  const ids = new Set(progressExerciseIds(params.exerciseId, params.exercises));
  const ladderTotal =
    shared?.ladderKey != null ? ladderRows(shared.ladderKey, params.exercises).length : null;

  // The shared exercise is the current rung. Rungs above it (a try, another
  // unit) are not part of its progress.
  const sharedStep = shared?.ladderKey != null ? (shared.ladderStep ?? null) : null;
  const aboveShared = (exerciseId: string) =>
    sharedStep != null && (byId.get(exerciseId)?.ladderStep ?? 0) > sharedStep;

  // One point per session: the highest rung done that day, its best set.
  const sessionPoints: (ProgressPoint & { perSide: boolean; kind: ExerciseKind })[] = [];
  for (const unit of params.units) {
    const bestByExercise = new Map<string, { value: number; perSide: boolean; kind: ExerciseKind; stored: string }>();
    for (const set of unit.sets) {
      if (set.exerciseId == null || !ids.has(set.exerciseId) || aboveShared(set.exerciseId)) {
        continue;
      }
      const value = setPerformanceValue(set);
      if (value == null || !(value > 0)) {
        continue;
      }
      const prev = bestByExercise.get(set.exerciseId);
      if (!prev || value > prev.value) {
        bestByExercise.set(set.exerciseId, {
          value,
          perSide: set.perSide,
          kind: set.kind,
          stored: set.exerciseName,
        });
      }
    }
    let pick: (typeof all)[number] | null = null;
    for (const [exerciseId, best] of bestByExercise) {
      const exercise = byId.get(exerciseId);
      const step = exercise?.ladderStep ?? null;
      if (!pick || (step ?? 0) > (pick.step ?? 0)) {
        pick = {
          dateKey: unit.loggedOn,
          value: best.value,
          exerciseId,
          exerciseName: nameOrFallback(exercise, params.lang, best.stored),
          step,
          perSide: best.perSide,
          kind: best.kind,
        };
      }
    }
    if (pick) {
      sessionPoints.push(pick);
    }
  }
  sessionPoints.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const all = risingRungs(sessionPoints);

  const latest = all[all.length - 1];
  const views: Partial<Record<ProgressPeriod, ProgressView>> = {};
  for (const period of PROGRESS_PERIODS) {
    const startKey = progressWindowStart(period, params.todayKey);
    // A week period that reaches past the first session would claim
    // "12 weeks ago" for a start that is younger; "seit Beginn" covers that.
    if (startKey != null && (all.length === 0 || all[0].dateKey >= startKey)) {
      continue;
    }
    const points = all
      .filter((point) => (startKey == null || point.dateKey >= startKey) && point.dateKey <= params.todayKey)
      .map(({ perSide: _perSide, kind: _kind, ...point }) => point);
    if (points.length < PROGRESS_MIN_SESSIONS) {
      continue;
    }
    const start = points[0];
    const current = points[points.length - 1];
    views[period] = {
      period,
      points,
      start,
      current,
      levelChanged: start.exerciseId !== current.exerciseId && start.step !== current.step,
    };
  }

  const weekPeriods = PROGRESS_PERIODS.filter((period) => period !== 'all').reverse();
  const period =
    weekPeriods.find((p) => (views[p]?.points.length ?? 0) >= PROGRESS_DEFAULT_MIN_SESSIONS) ??
    (views.all ? 'all' : (weekPeriods.find((p) => views[p]) ?? 'all'));

  return {
    kind: 'progress',
    // The rung the curve ends on: the shared one, or the rung below it
    // when the shared one has no sets yet.
    name: latest?.exerciseName ?? nameOrFallback(shared, params.lang, ''),
    exerciseKind: latest?.kind ?? shared?.kind ?? 'reps',
    perSide: latest?.perSide ?? shared?.perSide ?? false,
    ladderTotal: ladderTotal != null && ladderTotal >= 2 ? ladderTotal : null,
    views,
    period,
  };
}

/**
 * Chronological points whose rung never goes down: after a step up, sessions
 * that still use a lower rung (another unit, a warm-up) are left out, so a
 * change of rung is never drawn as a step back.
 */
export function risingRungs<T extends Pick<ProgressPoint, 'step'>>(points: readonly T[]): T[] {
  let top = Number.NEGATIVE_INFINITY;
  const out: T[] = [];
  for (const point of points) {
    const step = point.step ?? 0;
    if (step < top) {
      continue;
    }
    top = step;
    out.push(point);
  }
  return out;
}

/**
 * Relative height of each point in [0, 1]. Within one exercise the best set;
 * across a ladder every rung gets its own band ordered by step, so moving up a
 * rung reads as up even when the harder exercise has fewer reps.
 */
export function progressCurveLevels(points: readonly ProgressPoint[]): number[] {
  const steps = [...new Set(points.map((point) => point.step ?? 0))].sort((a, b) => a - b);
  const bandOf = new Map(steps.map((step, index) => [step, index]));
  const band = 1 / steps.length;
  return points.map((point) => {
    const step = point.step ?? 0;
    const same = points.filter((other) => (other.step ?? 0) === step).map((other) => other.value);
    const min = Math.min(...same);
    const max = Math.max(...same);
    const within = max === min ? 0.5 : (point.value - min) / (max - min);
    // Leave a gap between bands so the step up is visible.
    return (bandOf.get(step)! + (steps.length > 1 ? 0.1 + within * 0.6 : within)) * band;
  });
}

type GoalExercise = Pick<
  Exercise,
  'id' | 'names' | 'kind' | 'perSide' | 'ladderKey' | 'ladderStep' | 'userId' | 'archivedAt'
>;

export function buildGoalSticker(params: {
  goal: { exerciseId: string; targetValue: number };
  forecast: SkillGoalForecast;
  /** Exercise list holding the catalog, for names and the ladder. */
  exercises: readonly GoalExercise[];
  lang: string;
}): GoalStickerData {
  const byId = new Map(params.exercises.map((row) => [row.id, row]));
  const exercise = byId.get(params.goal.exerciseId);
  const { forecast } = params;
  const current = forecast.current;
  const currentExercise = current ? byId.get(current.exerciseId) : undefined;
  const onOtherRung = current != null && current.exerciseId !== params.goal.exerciseId;
  const achieved = forecast.status === 'achieved';
  return {
    kind: 'goal',
    name: nameOrFallback(exercise, params.lang, ''),
    exerciseKind: exercise?.kind ?? 'reps',
    perSide: exercise?.perSide ?? false,
    target: params.goal.targetValue,
    current:
      current == null || achieved
        ? null
        : {
            value: current.value,
            kind: currentExercise?.kind ?? exercise?.kind ?? 'reps',
            name: onOtherRung ? nameOrFallback(currentExercise, params.lang, '') || null : null,
          },
    progress: Math.min(1, Math.max(0, achieved ? 1 : forecast.progress)),
    period: forecast.status === 'ok' ? forecast.period : null,
    achieved,
    level: ladderPosition(exercise, params.exercises),
  };
}

/**
 * Target share of the card height for the content's layout box. Line heights
 * pad the box, so the visible content lands at about 65–70 %.
 */
export const STORY_FILL_TARGET = 0.7;
/** Never smaller than the sticker, never more than twice its size. */
export const STORY_SCALE_MIN = 1;
export const STORY_SCALE_MAX = 2;

/**
 * Next content scale for a story card, from the content height measured at
 * `scale`. Text wraps differently at other sizes, so the card re-measures and
 * calls this again until the change is negligible.
 */
export function nextStoryScale(params: {
  scale: number;
  contentHeight: number;
  cardHeight: number;
}): number {
  if (!(params.contentHeight > 0)) {
    return params.scale;
  }
  const target = params.cardHeight * STORY_FILL_TARGET;
  const next = (params.scale * target) / params.contentHeight;
  return Math.min(STORY_SCALE_MAX, Math.max(STORY_SCALE_MIN, next));
}

/** More labels crowd the photo; the rest of the plate is in kcal and protein. */
export const MEAL_STICKER_MAX_LABELS = 6;

export function buildMealSticker(params: {
  items: readonly { name: string; kcal: number; proteinG: number | null }[];
  portionFactor: number;
  photoUri: string | null;
}): MealStickerData {
  const factor = Number.isFinite(params.portionFactor) && params.portionFactor > 0
    ? params.portionFactor
    : 1;
  const named = params.items
    .map((item) => ({ ...item, name: item.name.trim() }))
    .filter((item) => item.name.length > 0);
  const labels = [...named]
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, MEAL_STICKER_MAX_LABELS)
    .map((item) => item.name);
  const kcal = Math.round(params.items.reduce((sum, item) => sum + item.kcal, 0) * factor);
  const withProtein = params.items.filter((item) => item.proteinG != null);
  const proteinG =
    withProtein.length > 0
      ? Math.round(withProtein.reduce((sum, item) => sum + (item.proteinG ?? 0), 0) * factor)
      : null;
  return { kind: 'meal', labels, kcal, proteinG, photoUri: params.photoUri };
}
