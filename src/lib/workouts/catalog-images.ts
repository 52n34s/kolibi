import type { ImageSource } from 'expo-image';

/**
 * Catalog slug → bundled illustration (16 seed exercises).
 *
 * Missing illustration files (do NOT add until assets exist — ExerciseThumb
 * falls back to the initial letter):
 *   incline_push_up, push_up, archer_push_up, pseudo_planche_push_up,
 *   elevated_pike_push_up, wall_handstand_push_up, straight_bar_dip,
 *   negative_pull_up, archer_pull_up, inverted_row_bent_knees,
 *   feet_elevated_inverted_row, archer_row, split_squat, pistol_squat_box,
 *   pistol_squat, glute_bridge, single_leg_hip_thrust, side_plank_leg_raise,
 *   tuck_hollow_hold, one_leg_l_sit, full_l_sit, hanging_leg_raise, toes_to_bar
 */
export const CATALOG_EXERCISE_IMAGES: Record<string, ImageSource> = {
  ytw_raise: require('@/assets/images/exercises/ytw_raise.webp'),
  pull_up: require('@/assets/images/exercises/pull_up.webp'),
  chin_up: require('@/assets/images/exercises/chin_up.webp'),
  inverted_row: require('@/assets/images/exercises/inverted_row.webp'),
  backpack_row_single_arm: require('@/assets/images/exercises/backpack_row_single_arm.webp'),
  backpack_curl: require('@/assets/images/exercises/backpack_curl.webp'),
  bulgarian_split_squat: require('@/assets/images/exercises/bulgarian_split_squat.webp'),
  single_leg_glute_bridge: require('@/assets/images/exercises/single_leg_glute_bridge.webp'),
  side_plank: require('@/assets/images/exercises/side_plank.webp'),
  hanging_knee_raise: require('@/assets/images/exercises/hanging_knee_raise.webp'),
  parallette_push_up: require('@/assets/images/exercises/parallette_push_up.webp'),
  parallel_bar_dip: require('@/assets/images/exercises/parallel_bar_dip.webp'),
  bench_dip: require('@/assets/images/exercises/bench_dip.webp'),
  pike_push_up: require('@/assets/images/exercises/pike_push_up.webp'),
  hollow_hold: require('@/assets/images/exercises/hollow_hold.webp'),
  l_sit: require('@/assets/images/exercises/l_sit.webp'),
};

export function getCatalogExerciseImage(slug: string | null | undefined): ImageSource | null {
  if (!slug) {
    return null;
  }
  return CATALOG_EXERCISE_IMAGES[slug] ?? null;
}
