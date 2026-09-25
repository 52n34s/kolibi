import {
  addToProfile,
  CATALOG_MUSCLES,
  emptyMuscleProfile,
  MUSCLE_GROUPS,
  musclesForExercise,
  type MuscleGroup,
  type MuscleProfile,
} from './muscles';
import type { Exercise } from './types';

/**
 * Weekly sets per muscle group (Block 3.4).
 *
 * Rules:
 * - Only done sets count (every session_sets row is a done set; `done: false`
 *   from an in-progress snapshot is skipped, as is a set with 0 reps and 0 s).
 * - Primary group = 1 set, secondary group = 0.5 set.
 * - Sets with reps in reserve 0–3 or without rir count; rir ≥ 4 is a warm-up.
 * - 7-day window: sum of today and the 6 days before.
 *   30-day window: sum of today and the 29 days before, as weekly average (× 7 / 30).
 * - Sets without exercise_id (exercise deleted) or with an unknown mapping
 *   have no muscles and are skipped.
 */

export type MuscleWindowDays = 7 | 30;

export type MuscleSetInput = {
  exerciseId: string | null;
  /** Local day key YYYY-MM-DD (workout_sessions.logged_on). */
  loggedOn: string;
  reps?: number | null;
  seconds?: number | null;
  done?: boolean;
  /** Reps in reserve (Block 2.5): 0–3 or null. */
  rir?: number | null;
};

type MuscleSource = Pick<Exercise, 'catalogSlug'> &
  Partial<Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>>;

export const MAX_COUNTED_RIR = 3;

/** Weekly lower mark: 10 sets for goal build_muscle, 6 for every other goal. */
export const WEEKLY_SET_TARGET_BUILD_MUSCLE = 10;
export const WEEKLY_SET_TARGET_DEFAULT = 6;

export function weeklySetTarget(goalType: string | null | undefined): number {
  return goalType === 'build_muscle'
    ? WEEKLY_SET_TARGET_BUILD_MUSCLE
    : WEEKLY_SET_TARGET_DEFAULT;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function setCounts(set: MuscleSetInput): boolean {
  if (set.done === false) {
    return false;
  }
  if (set.rir != null && set.rir > MAX_COUNTED_RIR) {
    return false;
  }
  if (set.reps != null || set.seconds != null) {
    return (set.reps ?? 0) > 0 || (set.seconds ?? 0) > 0;
  }
  return true;
}

export function inWindow(loggedOn: string, todayKey: string, days: MuscleWindowDays): boolean {
  const diff = dayNumber(todayKey) - dayNumber(loggedOn);
  return diff >= 0 && diff < days;
}

/** Weekly sets per group for the window (30 days → weekly average). */
export function countMuscleSets(params: {
  sets: readonly MuscleSetInput[];
  resolve: (exerciseId: string) => MuscleSource | undefined;
  todayKey: string;
  days: MuscleWindowDays;
}): MuscleProfile {
  const profile = emptyMuscleProfile();
  for (const set of params.sets) {
    if (set.exerciseId == null || !setCounts(set)) {
      continue;
    }
    if (!inWindow(set.loggedOn, params.todayKey, params.days)) {
      continue;
    }
    addToProfile(profile, musclesForExercise(params.resolve(set.exerciseId)), 1);
  }
  if (params.days === 30) {
    for (const group of MUSCLE_GROUPS) {
      profile[group] = (profile[group] * 7) / 30;
    }
  }
  return profile;
}

/** One decimal, so 6.53 shows as 6.5 and 6 stays 6. */
export function roundSets(value: number): number {
  return Math.round(value * 10) / 10;
}

export type MuscleStatus = {
  group: MuscleGroup;
  /** Weekly sets, rounded to one decimal. */
  sets: number;
  target: number;
  /** Whole sets still needed to reach the target (0 once reached). */
  missing: number;
  reached: boolean;
};

export function muscleStatus(
  counts: MuscleProfile,
  target: number,
  groups: readonly MuscleGroup[] = MUSCLE_GROUPS,
): MuscleStatus[] {
  return groups.map((group) => {
    const sets = roundSets(counts[group]);
    const missing = Math.max(0, Math.ceil(target - sets - 1e-9));
    return { group, sets, target, missing, reached: missing === 0 };
  });
}

const CATALOG_GROUPS: ReadonlySet<MuscleGroup> = new Set(
  Object.values(CATALOG_MUSCLES).flatMap((m) => [...m.primary, ...m.secondary]),
);

/**
 * Groups shown in the muscle view: everything the catalog trains, plus any
 * group the user trained or planned (e.g. calves from an own exercise).
 */
export function visibleMuscleGroups(profiles: readonly MuscleProfile[]): MuscleGroup[] {
  return MUSCLE_GROUPS.filter(
    (group) => CATALOG_GROUPS.has(group) || profiles.some((profile) => profile[group] > 0),
  );
}
