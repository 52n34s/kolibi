import type { ImageSource } from 'expo-image';

/** Catalog slug → bundled illustration (16 seed exercises). */
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
