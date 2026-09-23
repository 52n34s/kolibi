import type { ActiveExercise, Exercise } from '@/lib/workouts/types';

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

/** Catalog rows have no owner (or an explicit catalog slug). */
export function isCatalogExercise(
  exercise: Pick<Exercise, 'catalogSlug' | 'userId'>,
): boolean {
  return exercise.catalogSlug != null || exercise.userId == null;
}

/**
 * Display name for a session set / history row.
 * Catalog → resolve in current language; custom / missing → stored snapshot name.
 */
export function displayExerciseName(params: {
  exerciseId: string | null | undefined;
  storedName: string;
  exercise: Pick<Exercise, 'names' | 'catalogSlug' | 'userId'> | null | undefined;
  lang: string;
}): string {
  const stored = params.storedName.trim();
  if (params.exerciseId && params.exercise && isCatalogExercise(params.exercise)) {
    const resolved = resolveExerciseName(params.exercise, params.lang).trim();
    return resolved.length > 0 ? resolved : stored;
  }
  return stored;
}

/**
 * Display name for an in-progress session item.
 * Catalog exercises re-resolve on every render so a mid-session language switch updates.
 */
export function displayActiveExerciseName(
  item: Pick<ActiveExercise, 'name' | 'names' | 'catalogSlug'>,
  lang: string,
): string {
  const stored = item.name.trim();
  const names = item.names ?? {};
  const isCatalog = item.catalogSlug != null;
  if (isCatalog) {
    const resolved = resolveExerciseName({ names }, lang).trim();
    return resolved.length > 0 ? resolved : stored;
  }
  // Legacy MMKV snapshots without catalogSlug: multi-locale names ⇒ treat as catalog.
  const localeKeys = Object.keys(names).filter((k) => ['de', 'en', 'es'].includes(k));
  if (localeKeys.length > 1) {
    const resolved = resolveExerciseName({ names }, lang).trim();
    return resolved.length > 0 ? resolved : stored;
  }
  return stored;
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
