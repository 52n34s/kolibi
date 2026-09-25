import {
  PROGRESSION_NO_UPPER_BONUS,
  PROGRESSION_TIME_DELTA,
} from '@/lib/workouts/progression-rules';
import { setPerformanceValue } from '@/lib/workouts/progress';
import type { Exercise, ExerciseKind, SessionSet } from '@/lib/workouts/types';

/**
 * Skill goal forecast ("10 Archer-Klimmzüge", "30 s L-Sit").
 *
 * Fixed, tested rules — no model involved:
 *
 * 1. Ladder scale. Every catalog rung of the goal's ladder up to the goal rung
 *    is one unit ("rung"). On a lower rung the value is placed between the
 *    rung's entry value (default reps / seconds: where Kolibi starts you after
 *    a level-up) and its exit value (top of the rep range, or the time cap for
 *    holds: where Kolibi suggests the next rung). Position on rung i (0-based)
 *    is i + clamp((v − entry) / (exit − entry), 0, 1). Moving up at the exit
 *    and restarting at the entry of the next rung keeps the position
 *    continuous, so a rung change is neither a drop nor a jump.
 *    The goal rung runs from its entry to the target value; its end is the
 *    goal position G = number of rungs. Off-ladder the only rung runs from 0 to
 *    the target, so the position is value / target.
 *    Rungs above the goal rung are ignored; reps and seconds never mix because
 *    every rung is measured against its own range.
 * 2. One point per session: the highest position reached by any rung's best
 *    set that day. Exercises are matched by exercise_id only.
 * 3. Rate: Theil–Sen slope (median of pairwise slopes) of position over days
 *    across the sessions of the last SKILL_GOAL_LOOKBACK_DAYS days.
 * 4. Too little data: fewer than SKILL_GOAL_MIN_SESSIONS sessions in that
 *    window, or those sessions span fewer than SKILL_GOAL_MIN_SPAN_DAYS days.
 *    Then there is a hint instead of a date.
 * 5. Remaining = G − the trend line's value today; days = remaining / slope.
 *    A flat or falling trend gives no date; more than SKILL_GOAL_MAX_WEEKS
 *    weeks gives "more than a year".
 * 6. The date is shown as a period: ± max(SKILL_GOAL_BAND_MIN_DAYS,
 *    SKILL_GOAL_BAND_FRACTION × days), in month thirds (early / mid / late).
 */

export const SKILL_GOAL_LOOKBACK_DAYS = 56;
export const SKILL_GOAL_MIN_SESSIONS = 4;
export const SKILL_GOAL_MIN_SPAN_DAYS = 14;
export const SKILL_GOAL_MAX_WEEKS = 52;
export const SKILL_GOAL_BAND_FRACTION = 0.2;
export const SKILL_GOAL_BAND_MIN_DAYS = 7;
/** Below this many rungs per week the trend counts as flat. */
export const SKILL_GOAL_MIN_RATE_PER_WEEK = 0.005;

export type SkillGoalExercise = Pick<
  Exercise,
  | 'id'
  | 'kind'
  | 'perSide'
  | 'ladderKey'
  | 'ladderStep'
  | 'userId'
  | 'archivedAt'
  | 'defaultReps'
  | 'defaultRepsMax'
  | 'defaultSeconds'
  | 'defaultSecondsMax'
  | 'timeCapSeconds'
>;

export type SkillGoalRung = {
  exerciseId: string;
  /** Ladder step, null off-ladder. */
  step: number | null;
  kind: ExerciseKind;
  /** Lower end of the rung's scale. */
  from: number;
  /** Upper end: the exit value, or the target on the goal rung. */
  to: number;
};

export type SkillGoalUnit = {
  loggedOn: string;
  sets: readonly SessionSet[];
};

export type MonthPart = 'early' | 'mid' | 'late';

export type PeriodEdge = { part: MonthPart; month: number; year: number };

export type SkillGoalPeriod = { from: PeriodEdge; to: PeriodEdge };

export type SkillGoalCurrent = {
  exerciseId: string;
  value: number;
  step: number | null;
  dateKey: string;
};

type Base = {
  /** 0…1 along the ladder up to the target. */
  progress: number;
  /** Best set of the latest session on the goal ladder, null before the first one. */
  current: SkillGoalCurrent | null;
  /** Sessions on the goal ladder inside the lookback window. */
  sessionsInWindow: number;
};

export type SkillGoalForecast =
  | (Base & { status: 'achieved' })
  | (Base & { status: 'too_little_data'; sessionsNeeded: number; daysNeeded: number })
  | (Base & { status: 'no_trend' })
  | (Base & { status: 'beyond_year' })
  | (Base & {
      status: 'ok';
      etaKey: string;
      daysRemaining: number;
      period: SkillGoalPeriod;
    });

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

function addDays(key: string, days: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return toKey(date);
}

/** Whole calendar days from a to b (DST-safe via UTC). */
function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** Entry and exit value of a rung (see rule 1). */
export function rungRange(exercise: SkillGoalExercise): { entry: number; exit: number } {
  if (exercise.kind === 'time') {
    const entry = exercise.defaultSeconds ?? 0;
    const exit =
      exercise.timeCapSeconds ?? exercise.defaultSecondsMax ?? entry + 2 * PROGRESSION_TIME_DELTA;
    return { entry, exit: exit > entry ? exit : entry + PROGRESSION_TIME_DELTA };
  }
  const entry = exercise.defaultReps ?? 0;
  const exit = exercise.defaultRepsMax ?? entry + PROGRESSION_NO_UPPER_BONUS;
  return { entry, exit: exit > entry ? exit : entry + 1 };
}

/**
 * Rungs from the bottom of the ladder up to the goal rung, or the goal
 * exercise alone off-ladder. Null when the goal exercise is unknown.
 */
export function skillGoalRungs(
  goalExerciseId: string,
  targetValue: number,
  exercises: readonly SkillGoalExercise[],
): SkillGoalRung[] | null {
  const goal = exercises.find((row) => row.id === goalExerciseId);
  if (!goal || !(targetValue > 0)) {
    return null;
  }
  const onLadder =
    goal.ladderKey != null && goal.ladderStep != null && goal.userId == null;
  if (!onLadder) {
    return [{ exerciseId: goal.id, step: null, kind: goal.kind, from: 0, to: targetValue }];
  }
  const lower = exercises
    .filter(
      (row) =>
        row.ladderKey === goal.ladderKey &&
        row.userId == null &&
        row.archivedAt == null &&
        row.ladderStep != null &&
        row.ladderStep < goal.ladderStep! &&
        row.id !== goal.id,
    )
    .slice()
    .sort((a, b) => (a.ladderStep ?? 0) - (b.ladderStep ?? 0));
  const rungs: SkillGoalRung[] = lower.map((row) => {
    const { entry, exit } = rungRange(row);
    return { exerciseId: row.id, step: row.ladderStep, kind: row.kind, from: entry, to: exit };
  });
  const { entry } = rungRange(goal);
  const from = Math.max(0, Math.min(entry, targetValue - 1));
  rungs.push({ exerciseId: goal.id, step: goal.ladderStep, kind: goal.kind, from, to: targetValue });
  return rungs;
}

/** Position of a value on rung `index` (rule 1). */
export function rungPosition(rungs: readonly SkillGoalRung[], index: number, value: number): number {
  const rung = rungs[index]!;
  const within = (value - rung.from) / (rung.to - rung.from);
  const isGoalRung = index === rungs.length - 1;
  return index + (isGoalRung ? Math.max(0, within) : Math.min(1, Math.max(0, within)));
}

type SessionPoint = SkillGoalCurrent & { position: number };

/** One point per session, oldest first (rule 2). */
export function skillGoalPoints(
  rungs: readonly SkillGoalRung[],
  units: readonly SkillGoalUnit[],
): SessionPoint[] {
  const indexById = new Map(rungs.map((rung, index) => [rung.exerciseId, index]));
  const points: SessionPoint[] = [];
  for (const unit of units) {
    let pick: SessionPoint | null = null;
    for (const set of unit.sets) {
      if (set.exerciseId == null) {
        continue;
      }
      const index = indexById.get(set.exerciseId);
      if (index == null) {
        continue;
      }
      const value = setPerformanceValue(set);
      if (value == null || !(value > 0)) {
        continue;
      }
      const position = rungPosition(rungs, index, value);
      // On a tie the higher rung wins: that is the level the user trains now.
      if (
        !pick ||
        position > pick.position ||
        (position === pick.position && (rungs[index]!.step ?? 0) > (pick.step ?? 0))
      ) {
        pick = {
          exerciseId: set.exerciseId,
          value,
          step: rungs[index]!.step,
          dateKey: unit.loggedOn,
          position,
        };
      }
    }
    if (pick) {
      points.push(pick);
    }
  }
  return points.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function theilSen(points: readonly { x: number; y: number }[]): number | null {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j]!.x - points[i]!.x;
      if (dx !== 0) {
        slopes.push((points[j]!.y - points[i]!.y) / dx);
      }
    }
  }
  if (slopes.length === 0) {
    return null;
  }
  return median(slopes);
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function monthPart(dayOfMonth: number): MonthPart {
  if (dayOfMonth <= 10) {
    return 'early';
  }
  return dayOfMonth <= 20 ? 'mid' : 'late';
}

function edge(key: string): PeriodEdge {
  const date = parseKey(key);
  return { part: monthPart(date.getDate()), month: date.getMonth(), year: date.getFullYear() };
}

/** Period around the expected day (rule 6); never starts before tomorrow. */
export function skillGoalPeriod(todayKey: string, daysRemaining: number): SkillGoalPeriod {
  const band = Math.max(SKILL_GOAL_BAND_MIN_DAYS, daysRemaining * SKILL_GOAL_BAND_FRACTION);
  const fromDays = Math.max(1, Math.round(daysRemaining - band));
  const toDays = Math.max(fromDays, Math.round(daysRemaining + band));
  return { from: edge(addDays(todayKey, fromDays)), to: edge(addDays(todayKey, toDays)) };
}

export function isSamePeriodEdge(a: PeriodEdge, b: PeriodEdge): boolean {
  return a.part === b.part && a.month === b.month && a.year === b.year;
}

export function computeSkillGoalForecast(params: {
  goalExerciseId: string;
  targetValue: number;
  exercises: readonly SkillGoalExercise[];
  units: readonly SkillGoalUnit[];
  todayKey: string;
  /** Sessions from this day on can mark the goal as reached (goal created_at). */
  sinceKey?: string | null;
}): SkillGoalForecast | null {
  const rungs = skillGoalRungs(params.goalExerciseId, params.targetValue, params.exercises);
  if (!rungs) {
    return null;
  }
  const goalPosition = rungs.length;
  const units = params.units.filter((unit) => unit.loggedOn <= params.todayKey);
  const points = skillGoalPoints(rungs, units);
  const latest = points[points.length - 1] ?? null;
  const current: SkillGoalCurrent | null = latest
    ? { exerciseId: latest.exerciseId, value: latest.value, step: latest.step, dateKey: latest.dateKey }
    : null;
  const progress = latest ? Math.min(1, Math.max(0, latest.position / goalPosition)) : 0;

  const windowStart = addDays(params.todayKey, -(SKILL_GOAL_LOOKBACK_DAYS - 1));
  const windowPoints = points.filter((point) => point.dateKey >= windowStart);
  const base: Base = { progress, current, sessionsInWindow: windowPoints.length };

  const achieved = units.some(
    (unit) =>
      (params.sinceKey == null || unit.loggedOn >= params.sinceKey) &&
      unit.sets.some((set) => {
        if (set.exerciseId !== params.goalExerciseId) {
          return false;
        }
        const value = setPerformanceValue(set);
        return value != null && value >= params.targetValue;
      }),
  );
  if (achieved) {
    return { ...base, progress: 1, status: 'achieved' };
  }

  const span =
    windowPoints.length > 1
      ? dayIndex(windowPoints[windowPoints.length - 1]!.dateKey) - dayIndex(windowPoints[0]!.dateKey)
      : 0;
  if (windowPoints.length < SKILL_GOAL_MIN_SESSIONS || span < SKILL_GOAL_MIN_SPAN_DAYS) {
    return {
      ...base,
      status: 'too_little_data',
      sessionsNeeded: Math.max(0, SKILL_GOAL_MIN_SESSIONS - windowPoints.length),
      daysNeeded: Math.max(0, SKILL_GOAL_MIN_SPAN_DAYS - span),
    };
  }

  const xy = windowPoints.map((point) => ({ x: dayIndex(point.dateKey), y: point.position }));
  const slope = theilSen(xy);
  if (slope == null || slope * 7 < SKILL_GOAL_MIN_RATE_PER_WEEK) {
    return { ...base, status: 'no_trend' };
  }
  const intercept = median(xy.map((p) => p.y - slope * p.x));
  const today = dayIndex(params.todayKey);
  const nowOnTrend = Math.max(intercept + slope * today, latest?.position ?? 0);
  const daysRemaining = Math.max(
    SKILL_GOAL_BAND_MIN_DAYS,
    Math.round((goalPosition - nowOnTrend) / slope),
  );
  if (daysRemaining > SKILL_GOAL_MAX_WEEKS * 7) {
    return { ...base, status: 'beyond_year' };
  }
  return {
    ...base,
    status: 'ok',
    etaKey: addDays(params.todayKey, daysRemaining),
    daysRemaining,
    period: skillGoalPeriod(params.todayKey, daysRemaining),
  };
}

/**
 * Exercises the goal picker offers first: everything trained recently plus the
 * higher rungs of those exercises' ladders (the obvious next skills).
 */
export function suggestedGoalExerciseIds(
  recentExerciseIds: readonly string[],
  exercises: readonly SkillGoalExercise[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  for (const id of recentExerciseIds) {
    const exercise = exercises.find((row) => row.id === id);
    if (!exercise || exercise.archivedAt != null) {
      continue;
    }
    push(exercise.id);
    if (exercise.ladderKey == null || exercise.ladderStep == null) {
      continue;
    }
    exercises
      .filter(
        (row) =>
          row.ladderKey === exercise.ladderKey &&
          row.userId == null &&
          row.archivedAt == null &&
          (row.ladderStep ?? 0) > exercise.ladderStep!,
      )
      .sort((a, b) => (a.ladderStep ?? 0) - (b.ladderStep ?? 0))
      .forEach((row) => push(row.id));
  }
  return out;
}
