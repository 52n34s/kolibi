/** Tunables for suggestProgression (Block 13). */

/** sets_up only while current targetSets is strictly below this. */
export const PROGRESSION_SETS_UP_MAX = 5;

/** range_up / range_down delta for reps. */
export const PROGRESSION_REPS_RANGE_DELTA = 2;

/** Cap for reps after range_up. */
export const PROGRESSION_REPS_RANGE_MAX = 200;

/** Floor for reps after range_down. */
export const PROGRESSION_REPS_RANGE_MIN = 1;

/** time_up / time range_down delta (seconds). */
export const PROGRESSION_TIME_DELTA = 5;

/** Floor for seconds after range_down. */
export const PROGRESSION_TIME_RANGE_MIN = 5;

/**
 * When target has no upper bound, success requires every done set
 * ≥ lower bound + this bonus.
 */
export const PROGRESSION_NO_UPPER_BONUS = 2;

/**
 * After declining a suggestion of kind K, wait until this many qualifying
 * sessions exist since that event before suggesting K again.
 */
export const PROGRESSION_DECLINED_COOLDOWN_SESSIONS = 2;
