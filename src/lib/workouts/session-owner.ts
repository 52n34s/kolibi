import type { ActiveSession } from './types';

/**
 * Ownership gate for the persisted training state.
 *
 * The active session, the sync queue and the rest timer live in MMKV, which
 * survives a sign-out. Without this check, logging in as someone else would
 * hand them the previous account's half-finished session — and finishing it
 * would file those sets under the new user.
 */

export type OwnershipVerdict = 'keep' | 'no-session' | 'no-user' | 'unowned' | 'foreign';

export function sessionOwnership(
  session: Pick<ActiveSession, 'userId'> | null | undefined,
  currentUserId: string | null | undefined,
): OwnershipVerdict {
  if (session == null) {
    return 'no-session';
  }
  // Sessions written before userId existed cannot be attributed — drop them.
  if (typeof session.userId !== 'string' || session.userId.length === 0) {
    return 'unowned';
  }
  if (currentUserId == null || currentUserId.length === 0) {
    return 'no-user';
  }
  return session.userId === currentUserId ? 'keep' : 'foreign';
}

/** The session if it belongs to `currentUserId`, otherwise null. */
export function keepSessionForUser(
  session: ActiveSession | null | undefined,
  currentUserId: string | null | undefined,
): ActiveSession | null {
  return sessionOwnership(session, currentUserId) === 'keep' ? (session ?? null) : null;
}
