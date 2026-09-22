/**
 * Flip to `true` after App Store submission so the training surface ships
 * without waiting on the remote `training_tab` feature flag.
 * Until then the flag remains the release switch.
 */
export const TRAINING_RELEASED = true;

/** True when training UI should be available (released OR flag on). */
export function resolveTrainingTabEnabled(flagEnabled: boolean): boolean {
  return TRAINING_RELEASED || flagEnabled;
}
