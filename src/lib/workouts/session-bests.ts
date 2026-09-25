import { withoutSession } from './progression-history';
import type { SessionSet } from './types';

export function bestPriorValue(
  history: SessionSet[],
  kind: 'reps' | 'weighted' | 'time',
): number | null {
  let best: number | null = null;
  for (const set of history) {
    const value = kind === 'time' ? set.seconds : set.reps;
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    if (best == null || value > best) {
      best = value;
    }
  }
  return best;
}

export function bestSessionValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

/**
 * The session's best when it beats every earlier session, else null. A first
 * execution has nothing to beat and is not a best. History fetched for the
 * summary already holds the session's own synced sets; they are left out, or
 * the session could never beat itself.
 */
export function newSessionBest(input: {
  values: number[];
  history: SessionSet[];
  kind: 'reps' | 'weighted' | 'time';
  sessionId: string;
}): number | null {
  const sessionBest = bestSessionValue(input.values);
  if (sessionBest == null) {
    return null;
  }
  const prior = bestPriorValue(withoutSession(input.history, input.sessionId), input.kind);
  if (prior == null || sessionBest <= prior) {
    return null;
  }
  return sessionBest;
}
