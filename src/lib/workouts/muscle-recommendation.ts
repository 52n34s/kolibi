import type { MuscleStatus } from './muscle-volume';
import {
  CATALOG_MUSCLES,
  musclesForExercise,
  unitMuscleProfile,
  type MuscleGroup,
} from './muscles';
import type { Exercise, WorkoutTemplate } from './types';
import type { SaveTemplateInput } from './workouts-api';

/**
 * Recommendation per muscle group below its weekly target (Block 3.4).
 *
 * Exercise choice, first match wins; only exercises with the group as
 * primary qualify, so every added set counts as a full set:
 * 1. an exercise of an active unit (units by position, exercises by position);
 * 2. an exercise trained recently (newest set first);
 * 3. the catalog: reps before holds, lowest ladder rung, catalog order.
 * For ladder exercises (1, 2) the user's current rung replaces the exercise:
 * the rung in an active unit, else the rung trained most recently.
 */

export type RecentSet = { exerciseId: string | null; completedAt: string };

export type MuscleRecommendation = {
  group: MuscleGroup;
  sets: number;
  target: number;
  /** Extra sets per week, all of `exercise`. */
  setsToAdd: number;
  exercise: Exercise;
};

type Context = {
  units: readonly WorkoutTemplate[];
  recentSets: readonly RecentSet[];
  /** Catalog + own exercises (fetchExercises). */
  exercises: readonly Exercise[];
};

function sortedUnitExercises(units: readonly WorkoutTemplate[]): Exercise[] {
  return [...units]
    .sort((a, b) => a.position - b.position)
    .flatMap((unit) =>
      [...unit.exercises].sort((a, b) => a.position - b.position).map((item) => item.exercise),
    );
}

function recentExercises(ctx: Context, byId: Map<string, Exercise>): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();
  const sorted = [...ctx.recentSets].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  for (const set of sorted) {
    if (set.exerciseId == null || seen.has(set.exerciseId)) {
      continue;
    }
    seen.add(set.exerciseId);
    const exercise = byId.get(set.exerciseId);
    if (exercise) {
      out.push(exercise);
    }
  }
  return out;
}

/** Ladder key → the user's current rung (active unit first, else most recent set). */
export function currentRungs(ctx: Context): Map<string, Exercise> {
  const byId = new Map(ctx.exercises.map((exercise) => [exercise.id, exercise]));
  const rungs = new Map<string, Exercise>();
  for (const exercise of recentExercises(ctx, byId)) {
    if (exercise.ladderKey && !rungs.has(exercise.ladderKey)) {
      rungs.set(exercise.ladderKey, exercise);
    }
  }
  const fromUnits = new Map<string, Exercise>();
  for (const exercise of sortedUnitExercises(ctx.units)) {
    if (exercise.ladderKey && !fromUnits.has(exercise.ladderKey)) {
      fromUnits.set(exercise.ladderKey, exercise);
    }
  }
  for (const [key, exercise] of fromUnits) {
    rungs.set(key, exercise);
  }
  return rungs;
}

const CATALOG_ORDER = Object.keys(CATALOG_MUSCLES);

function catalogFallback(group: MuscleGroup, exercises: readonly Exercise[]): Exercise | null {
  const candidates = exercises.filter(
    (exercise) =>
      exercise.catalogSlug != null &&
      exercise.archivedAt == null &&
      musclesForExercise(exercise).primary.includes(group),
  );
  candidates.sort((a, b) => {
    const kindA = a.kind === 'time' ? 1 : 0;
    const kindB = b.kind === 'time' ? 1 : 0;
    if (kindA !== kindB) return kindA - kindB;
    const stepA = a.ladderStep ?? 1;
    const stepB = b.ladderStep ?? 1;
    if (stepA !== stepB) return stepA - stepB;
    return CATALOG_ORDER.indexOf(a.catalogSlug!) - CATALOG_ORDER.indexOf(b.catalogSlug!);
  });
  return candidates[0] ?? null;
}

export function exerciseForMuscle(group: MuscleGroup, ctx: Context): Exercise | null {
  const byId = new Map(ctx.exercises.map((exercise) => [exercise.id, exercise]));
  const rungs = currentRungs(ctx);
  const resolve = (exercise: Exercise) => byId.get(exercise.id) ?? exercise;
  const onRung = (exercise: Exercise) =>
    exercise.ladderKey ? (rungs.get(exercise.ladderKey) ?? exercise) : exercise;
  const hitsPrimary = (exercise: Exercise) =>
    musclesForExercise(resolve(exercise)).primary.includes(group);

  for (const exercise of sortedUnitExercises(ctx.units)) {
    if (hitsPrimary(exercise)) {
      return resolve(exercise);
    }
  }
  for (const exercise of recentExercises(ctx, byId)) {
    const rung = onRung(exercise);
    if (hitsPrimary(rung)) {
      return resolve(rung);
    }
  }
  return catalogFallback(group, ctx.exercises);
}

export function recommendForMuscles(
  rows: readonly MuscleStatus[],
  ctx: Context,
): MuscleRecommendation[] {
  const out: MuscleRecommendation[] = [];
  for (const row of rows) {
    if (row.reached) {
      continue;
    }
    const exercise = exerciseForMuscle(row.group, ctx);
    if (!exercise) {
      continue;
    }
    out.push({
      group: row.group,
      sets: row.sets,
      target: row.target,
      setsToAdd: row.missing,
      exercise,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// "In Einheit übernehmen"
// ---------------------------------------------------------------------------

export const MAX_TARGET_SETS = 20;

export type UnitAdoption = {
  unit: WorkoutTemplate;
  exercise: Exercise;
  /** Sets of the exercise in the unit today; null = the exercise is new there. */
  fromSets: number | null;
  toSets: number;
  save: SaveTemplateInput;
};

function nextIsoWeekday(day: number): number {
  return day === 7 ? 1 : day + 1;
}

/**
 * True when the unit is scheduled the day before a unit (itself included)
 * that trains `group` — extra sets there would cut into recovery.
 */
export function isDayBeforeSameMuscles(
  unit: WorkoutTemplate,
  units: readonly WorkoutTemplate[],
  group: MuscleGroup,
  lookup?: (exerciseId: string) => Exercise | undefined,
): boolean {
  if (unit.weekdays.length === 0) {
    return false;
  }
  const nextDays = new Set(unit.weekdays.map(nextIsoWeekday));
  return units.some(
    (other) =>
      other.weekdays.some((day) => nextDays.has(day)) &&
      unitMuscleProfile(other, lookup)[group] > 0,
  );
}

function totalSets(unit: WorkoutTemplate): number {
  return unit.exercises.reduce((sum, item) => sum + item.targetSets, 0);
}

/**
 * Picks the unit for a recommendation and builds the save input.
 *
 * Candidates: every active unit that is not the day before a unit with the
 * same group and still has room (≤ 20 sets per exercise).
 * Order: best match (share of the unit's weighted sets on the group, one
 * decimal), then fewest target sets, then position.
 * Sets per session = weekly sets ÷ sessions per week (weekdays, at least 1),
 * rounded up. A unit that already holds a rung of the same ladder gets the
 * extra sets on that rung instead of a second rung.
 */
export function planUnitAdoption(params: {
  recommendation: Pick<MuscleRecommendation, 'group' | 'setsToAdd' | 'exercise'>;
  units: readonly WorkoutTemplate[];
  lookup?: (exerciseId: string) => Exercise | undefined;
}): UnitAdoption | null {
  const { recommendation, units, lookup } = params;
  const { group, exercise } = recommendation;
  if (recommendation.setsToAdd < 1) {
    return null;
  }

  type Scored = { unit: WorkoutTemplate; share: number; total: number };
  const scored: Scored[] = [];
  for (const unit of units) {
    if (isDayBeforeSameMuscles(unit, units, group, lookup)) {
      continue;
    }
    const existing = findTarget(unit, exercise, group);
    if (existing && existing.targetSets >= MAX_TARGET_SETS) {
      continue;
    }
    const profile = unitMuscleProfile(unit, lookup);
    const weight = Object.values(profile).reduce((sum, value) => sum + value, 0);
    const share = weight > 0 ? Math.round((profile[group] / weight) * 10) / 10 : 0;
    scored.push({ unit, share, total: totalSets(unit) });
  }
  scored.sort(
    (a, b) => b.share - a.share || a.total - b.total || a.unit.position - b.unit.position,
  );
  const best = scored[0];
  if (!best) {
    return null;
  }

  const unit = best.unit;
  const sessionsPerWeek = Math.max(1, unit.weekdays.length);
  const perSession = Math.max(1, Math.ceil(recommendation.setsToAdd / sessionsPerWeek));
  const existing = findTarget(unit, exercise, group);
  const ordered = [...unit.exercises].sort((a, b) => a.position - b.position);
  const exercises = ordered.map((item) => ({
    exerciseId: item.exerciseId,
    targetSets:
      existing && item.id === existing.id
        ? Math.min(MAX_TARGET_SETS, item.targetSets + perSession)
        : item.targetSets,
    targetReps: item.targetReps,
    targetRepsMax: item.targetRepsMax,
    targetSeconds: item.targetSeconds,
    targetSecondsMax: item.targetSecondsMax,
    targetWeightKg: item.targetWeightKg,
    restSeconds: item.restSeconds,
  }));
  const toSets = existing
    ? Math.min(MAX_TARGET_SETS, existing.targetSets + perSession)
    : Math.min(MAX_TARGET_SETS, perSession);
  if (!existing) {
    exercises.push({
      exerciseId: exercise.id,
      targetSets: toSets,
      targetReps: exercise.kind === 'time' ? null : exercise.defaultReps,
      targetRepsMax: exercise.kind === 'time' ? null : exercise.defaultRepsMax,
      targetSeconds: exercise.kind === 'time' ? exercise.defaultSeconds : null,
      targetSecondsMax: exercise.kind === 'time' ? exercise.defaultSecondsMax : null,
      targetWeightKg: null,
      restSeconds: null,
    });
  }

  return {
    unit,
    exercise: existing ? existing.exercise : exercise,
    fromSets: existing ? existing.targetSets : null,
    toSets,
    save: {
      id: unit.id,
      name: unit.name,
      shortLabel: unit.shortLabel,
      colorKey: unit.colorKey,
      weekdays: unit.weekdays,
      position: unit.position,
      exercises,
    },
  };
}

/** Same exercise in the unit, else a rung of the same ladder that hits `group` as primary. */
function findTarget(unit: WorkoutTemplate, exercise: Exercise, group: MuscleGroup) {
  const same = unit.exercises.find((item) => item.exerciseId === exercise.id);
  if (same) {
    return same;
  }
  if (!exercise.ladderKey) {
    return undefined;
  }
  return unit.exercises.find(
    (item) =>
      item.exercise.ladderKey === exercise.ladderKey &&
      musclesForExercise(item.exercise).primary.includes(group),
  );
}
