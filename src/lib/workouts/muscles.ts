import type { Exercise, MuscleGroup, WorkoutTemplate } from './types';

export type { MuscleGroup } from './types';

/** Display order: push, pull, core, legs. */
export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'shoulders',
  'triceps',
  'back',
  'biceps',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

export function isMuscleGroup(value: string): value is MuscleGroup {
  return (MUSCLE_GROUPS as readonly string[]).includes(value);
}

export type MuscleMapping = {
  primary: readonly MuscleGroup[];
  secondary: readonly MuscleGroup[];
};

const NONE: MuscleMapping = { primary: [], secondary: [] };

/**
 * Catalog slug → worked muscle groups. Catalog rows are fixed per slug
 * (user_id null), so the mapping lives next to catalog-images and
 * starter-plans instead of in the database. Grouped by ladder in ladder order.
 *
 * Primary counts as a full set, secondary as half a set (muscle-volume.ts).
 * muscles.test.ts checks every slug seeded in supabase/migrations.
 */
export const CATALOG_MUSCLES: Readonly<Record<string, MuscleMapping>> = {
  // push_horizontal
  wall_push_up: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  incline_push_up: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  push_up: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  parallette_push_up: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  archer_push_up: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  pseudo_planche_push_up: { primary: ['chest', 'shoulders'], secondary: ['triceps', 'core'] },

  // push_vertical
  elevated_hands_pike_push_up: { primary: ['shoulders'], secondary: ['triceps'] },
  pike_push_up: { primary: ['shoulders'], secondary: ['triceps'] },
  elevated_pike_push_up: { primary: ['shoulders'], secondary: ['triceps'] },
  wall_handstand_push_up: { primary: ['shoulders'], secondary: ['triceps', 'core'] },

  // dip
  bench_dip_bent_knees: { primary: ['triceps'], secondary: ['shoulders', 'chest'] },
  bench_dip: { primary: ['triceps'], secondary: ['shoulders', 'chest'] },
  parallel_bar_dip: { primary: ['chest', 'triceps'], secondary: ['shoulders'] },
  straight_bar_dip: { primary: ['chest', 'triceps'], secondary: ['shoulders'] },

  // pull_vertical
  dead_hang: { primary: ['back'], secondary: ['shoulders'] },
  active_hang: { primary: ['back'], secondary: ['shoulders'] },
  negative_pull_up: { primary: ['back'], secondary: ['biceps'] },
  chin_up: { primary: ['back', 'biceps'], secondary: [] },
  pull_up: { primary: ['back'], secondary: ['biceps'] },
  archer_pull_up: { primary: ['back'], secondary: ['biceps', 'shoulders'] },

  // row
  inverted_row_bent_knees: { primary: ['back'], secondary: ['biceps'] },
  inverted_row: { primary: ['back'], secondary: ['biceps'] },
  feet_elevated_inverted_row: { primary: ['back'], secondary: ['biceps'] },
  archer_row: { primary: ['back'], secondary: ['biceps', 'core'] },

  // squat_single
  box_squat: { primary: ['quads'], secondary: ['glutes'] },
  bodyweight_squat: { primary: ['quads'], secondary: ['glutes'] },
  split_squat: { primary: ['quads'], secondary: ['glutes'] },
  bulgarian_split_squat: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  pistol_squat_box: { primary: ['quads'], secondary: ['glutes', 'core'] },
  pistol_squat: { primary: ['quads', 'glutes'], secondary: ['core'] },

  // bridge
  glute_bridge: { primary: ['glutes'], secondary: ['hamstrings'] },
  single_leg_glute_bridge: { primary: ['glutes'], secondary: ['hamstrings'] },
  single_leg_hip_thrust: { primary: ['glutes'], secondary: ['hamstrings'] },

  // side_plank
  side_plank_knees: { primary: ['core'], secondary: [] },
  side_plank: { primary: ['core'], secondary: ['shoulders'] },
  side_plank_leg_raise: { primary: ['core'], secondary: ['glutes', 'shoulders'] },

  // hanging
  lying_leg_raise: { primary: ['core'], secondary: [] },
  hanging_knee_raise: { primary: ['core'], secondary: [] },
  hanging_leg_raise: { primary: ['core'], secondary: [] },
  toes_to_bar: { primary: ['core'], secondary: ['back'] },

  // hollow
  tuck_hollow_hold: { primary: ['core'], secondary: [] },
  hollow_hold: { primary: ['core'], secondary: [] },

  // l_sit
  l_sit: { primary: ['core'], secondary: ['triceps', 'quads'] },
  one_leg_l_sit: { primary: ['core'], secondary: ['triceps', 'quads'] },
  full_l_sit: { primary: ['core'], secondary: ['triceps', 'quads'] },

  // outside a ladder
  ytw_raise: { primary: ['shoulders'], secondary: ['back'] },
  backpack_row_single_arm: { primary: ['back'], secondary: ['biceps'] },
  backpack_curl: { primary: ['biceps'], secondary: [] },
};

type MuscleSource = Pick<Exercise, 'catalogSlug'> &
  Partial<Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>>;

function cleanGroups(values: readonly string[] | null | undefined): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  for (const value of values ?? []) {
    if (isMuscleGroup(value) && !out.includes(value)) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Muscle groups of one exercise: catalog slug (string or exercise) via
 * CATALOG_MUSCLES, own exercises via their stored selection. A group listed
 * as primary never counts again as secondary. Unknown → empty mapping.
 */
export function musclesForExercise(
  slugOrExercise: string | MuscleSource | null | undefined,
): MuscleMapping {
  if (slugOrExercise == null) {
    return NONE;
  }
  if (typeof slugOrExercise === 'string') {
    return CATALOG_MUSCLES[slugOrExercise] ?? NONE;
  }
  if (slugOrExercise.catalogSlug) {
    return CATALOG_MUSCLES[slugOrExercise.catalogSlug] ?? NONE;
  }
  const primary = cleanGroups(slugOrExercise.primaryMuscles);
  const secondary = cleanGroups(slugOrExercise.secondaryMuscles).filter(
    (group) => !primary.includes(group),
  );
  return { primary, secondary };
}

/** Weight of one set of this exercise for `group`: 1 primary, 0.5 secondary, else 0. */
export function muscleWeight(mapping: MuscleMapping, group: MuscleGroup): number {
  if (mapping.primary.includes(group)) {
    return 1;
  }
  if (mapping.secondary.includes(group)) {
    return 0.5;
  }
  return 0;
}

export type MuscleProfile = Record<MuscleGroup, number>;

export function emptyMuscleProfile(): MuscleProfile {
  return {
    chest: 0,
    shoulders: 0,
    triceps: 0,
    back: 0,
    biceps: 0,
    core: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
  };
}

/** Adds `sets` of an exercise with `mapping` to `profile` (in place). */
export function addToProfile(profile: MuscleProfile, mapping: MuscleMapping, sets: number) {
  for (const group of mapping.primary) {
    profile[group] += sets;
  }
  for (const group of mapping.secondary) {
    profile[group] += sets * 0.5;
  }
}

/**
 * Weighted sets per session of a unit (target sets × 1 / 0.5). The exercise
 * nested in each template row decides the mapping; `lookup` can supply a
 * fresher exercise row (e.g. own exercise with muscles from fetchExercises).
 */
export function unitMuscleProfile(
  unit: Pick<WorkoutTemplate, 'exercises'>,
  lookup?: (exerciseId: string) => MuscleSource | undefined,
): MuscleProfile {
  const profile = emptyMuscleProfile();
  for (const item of unit.exercises) {
    const source = lookup?.(item.exerciseId) ?? item.exercise;
    addToProfile(profile, musclesForExercise(source), item.targetSets);
  }
  return profile;
}

/** Groups a profile touches at all (weight > 0), in display order. */
export function profileGroups(profile: MuscleProfile): MuscleGroup[] {
  return MUSCLE_GROUPS.filter((group) => profile[group] > 0);
}
