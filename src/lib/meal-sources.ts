/**
 * Live `meal_source` enum on public.meals:
 * 'photo' | 'manual' | 'photo_gallery' | 'barcode'
 */
export const MEAL_SOURCE = {
  PHOTO_CAMERA: 'photo',
  PHOTO_GALLERY: 'photo_gallery',
  BARCODE: 'barcode',
  MANUAL: 'manual',
} as const;

export type MealSource = (typeof MEAL_SOURCE)[keyof typeof MEAL_SOURCE];

/** Only live-camera corrections feed portion calibration. */
export function includeMealInCalibration(source: MealSource): boolean {
  return source === MEAL_SOURCE.PHOTO_CAMERA;
}
