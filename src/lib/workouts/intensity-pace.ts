/**
 * Suggest gym intensity from real logged pace: seconds per completed work set.
 *
 * secondsPerSet = durationMinutes × 60 / doneSetCount
 * Few seconds → short rests / high breathing rate → hard.
 * Many seconds → long rests → easy.
 */

import type { GymIntensity } from '@/lib/workouts/types';

/** Below this many seconds per set → hard. */
export const INTENSITY_PACE_HARD_BELOW_SEC = 60;

/** Above this many seconds per set → easy; inclusive range in between is normal. */
export const INTENSITY_PACE_EASY_ABOVE_SEC = 120;

/** Fewer completed sets than this → no suggestion (too noisy). */
export const INTENSITY_PACE_MIN_DONE_SETS = 3;

export function suggestGymIntensityFromSetPace(params: {
  durationMinutes: number;
  doneSetCount: number;
}): GymIntensity | null {
  if (params.doneSetCount < INTENSITY_PACE_MIN_DONE_SETS) {
    return null;
  }
  if (!(params.durationMinutes > 0) || !Number.isFinite(params.durationMinutes)) {
    return null;
  }

  const secondsPerSet = (params.durationMinutes * 60) / params.doneSetCount;
  if (!(secondsPerSet > 0) || !Number.isFinite(secondsPerSet)) {
    return null;
  }

  if (secondsPerSet < INTENSITY_PACE_HARD_BELOW_SEC) {
    return 'hard';
  }
  if (secondsPerSet <= INTENSITY_PACE_EASY_ABOVE_SEC) {
    return 'normal';
  }
  return 'easy';
}
