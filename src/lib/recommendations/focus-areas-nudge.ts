import type { StringKvStorage } from '../workouts/kv-storage';

/**
 * The one-time card on Today that asks for focus areas.
 *
 * It waits a week: before that there is little to rank, and the question
 * would be one more thing to answer during setup. Once someone has picked, or
 * pushed the card away, it never comes back — the same question lives on in
 * the goals screen.
 */

/** Only from this many days after the account was created. */
export const FOCUS_AREAS_NUDGE_AFTER_DAYS = 7;

export function focusAreasNudgeKey(userId: string): string {
  return `focusAreas.nudgeDismissed.${userId}`;
}

export function shouldShowFocusAreasNudge(params: {
  /** auth user created_at; null / unparsable = unknown, and unknown stays quiet. */
  accountCreatedAt: string | null | undefined;
  /** Already chosen topics; anything non-empty hides the card. */
  focusAreas: readonly string[] | null | undefined;
  dismissed: boolean;
  nowMs: number;
}): boolean {
  if (params.dismissed || (params.focusAreas?.length ?? 0) > 0) {
    return false;
  }
  if (!params.accountCreatedAt) {
    return false;
  }
  const createdAt = Date.parse(params.accountCreatedAt);
  if (!Number.isFinite(createdAt)) {
    return false;
  }
  const days = (params.nowMs - createdAt) / (24 * 60 * 60 * 1000);
  return days >= FOCUS_AREAS_NUDGE_AFTER_DAYS;
}

export function readFocusAreasNudgeDismissed(
  storage: StringKvStorage,
  userId: string,
): boolean {
  try {
    return storage.getString(focusAreasNudgeKey(userId)) !== undefined;
  } catch {
    return false;
  }
}

/** Stores the dismissal; worst case the card comes back on the next start. */
export function writeFocusAreasNudgeDismissed(
  storage: StringKvStorage,
  userId: string,
  at: Date,
): void {
  try {
    storage.set(focusAreasNudgeKey(userId), at.toISOString());
  } catch {
    // Nothing to do — the card is not worth an error.
  }
}
