import type { Exercise } from '@/lib/workouts/types';

/** Resolve a localized exercise name with fallbacks. */
export function resolveExerciseName(
  exercise: Pick<Exercise, 'names'>,
  lang: string,
): string {
  const names = exercise.names ?? {};
  const direct = names[lang];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  const de = names.de;
  if (typeof de === 'string' && de.trim().length > 0) {
    return de.trim();
  }
  const en = names.en;
  if (typeof en === 'string' && en.trim().length > 0) {
    return en.trim();
  }
  for (const value of Object.values(names)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}


/**
 * A name for an exercise that may not be loaded.
 *
 * Never falls back to an id: a UUID in user-facing output (export, share
 * sheet) is noise, not information.
 */
export function exerciseLabelOrFallback(
  exercise: Parameters<typeof resolveExerciseName>[0] | null | undefined,
  lang: string,
  fallback: string,
): string {
  if (exercise == null) {
    return fallback;
  }
  const name = resolveExerciseName(exercise, lang).trim();
  return name.length > 0 ? name : fallback;
}
