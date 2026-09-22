import type { ImageSource } from 'expo-image';

/**
 * Catalog slug → bundled illustration.
 *
 * Grouped by progression ladder in ladder order, so a missing step is visible
 * at a glance. Every one of the 39 seed exercises has an illustration;
 * ExerciseThumb falls back to the initial letter for anything not listed here
 * (own exercises without a photo).
 */
export const CATALOG_EXERCISE_IMAGES: Record<string, ImageSource> = {
  // push_horizontal
  incline_push_up: require('@/assets/images/exercises/incline_push_up.webp'),
  push_up: require('@/assets/images/exercises/push_up.webp'),
  parallette_push_up: require('@/assets/images/exercises/parallette_push_up.webp'),
  archer_push_up: require('@/assets/images/exercises/archer_push_up.webp'),
  pseudo_planche_push_up: require('@/assets/images/exercises/pseudo_planche_push_up.webp'),

  // push_vertical
  pike_push_up: require('@/assets/images/exercises/pike_push_up.webp'),
  elevated_pike_push_up: require('@/assets/images/exercises/elevated_pike_push_up.webp'),
  wall_handstand_push_up: require('@/assets/images/exercises/wall_handstand_push_up.webp'),

  // dip
  bench_dip: require('@/assets/images/exercises/bench_dip.webp'),
  parallel_bar_dip: require('@/assets/images/exercises/parallel_bar_dip.webp'),
  straight_bar_dip: require('@/assets/images/exercises/straight_bar_dip.webp'),

  // pull_vertical
  negative_pull_up: require('@/assets/images/exercises/negative_pull_up.webp'),
  pull_up: require('@/assets/images/exercises/pull_up.webp'),
  archer_pull_up: require('@/assets/images/exercises/archer_pull_up.webp'),

  // row
  inverted_row_bent_knees: require('@/assets/images/exercises/inverted_row_bent_knees.webp'),
  inverted_row: require('@/assets/images/exercises/inverted_row.webp'),
  feet_elevated_inverted_row: require('@/assets/images/exercises/feet_elevated_inverted_row.webp'),
  archer_row: require('@/assets/images/exercises/archer_row.webp'),

  // squat_single
  split_squat: require('@/assets/images/exercises/split_squat.webp'),
  bulgarian_split_squat: require('@/assets/images/exercises/bulgarian_split_squat.webp'),
  pistol_squat_box: require('@/assets/images/exercises/pistol_squat_box.webp'),
  pistol_squat: require('@/assets/images/exercises/pistol_squat.webp'),

  // bridge
  glute_bridge: require('@/assets/images/exercises/glute_bridge.webp'),
  single_leg_glute_bridge: require('@/assets/images/exercises/single_leg_glute_bridge.webp'),
  single_leg_hip_thrust: require('@/assets/images/exercises/single_leg_hip_thrust.webp'),

  // side_plank
  side_plank: require('@/assets/images/exercises/side_plank.webp'),
  side_plank_leg_raise: require('@/assets/images/exercises/side_plank_leg_raise.webp'),

  // hollow
  tuck_hollow_hold: require('@/assets/images/exercises/tuck_hollow_hold.webp'),
  hollow_hold: require('@/assets/images/exercises/hollow_hold.webp'),

  // l_sit
  l_sit: require('@/assets/images/exercises/l_sit.webp'),
  one_leg_l_sit: require('@/assets/images/exercises/one_leg_l_sit.webp'),
  full_l_sit: require('@/assets/images/exercises/full_l_sit.webp'),

  // hanging
  hanging_knee_raise: require('@/assets/images/exercises/hanging_knee_raise.webp'),
  hanging_leg_raise: require('@/assets/images/exercises/hanging_leg_raise.webp'),
  toes_to_bar: require('@/assets/images/exercises/toes_to_bar.webp'),

  // no ladder
  ytw_raise: require('@/assets/images/exercises/ytw_raise.webp'),
  chin_up: require('@/assets/images/exercises/chin_up.webp'),
  backpack_row_single_arm: require('@/assets/images/exercises/backpack_row_single_arm.webp'),
  backpack_curl: require('@/assets/images/exercises/backpack_curl.webp'),
};

export function getCatalogExerciseImage(slug: string | null | undefined): ImageSource | null {
  if (!slug) {
    return null;
  }
  return CATALOG_EXERCISE_IMAGES[slug] ?? null;
}
