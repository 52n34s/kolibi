import type { StringKvStorage } from '../workouts/kv-storage';
import type { RecommendationKind } from './recommendations';

/**
 * Dismissed recommendations per user, on this device only:
 * kind → ISO timestamp of the dismissal. The 3-day snooze itself is judged in
 * buildRecommendations (isSnoozed).
 */

export type RecommendationDismissals = Partial<Record<RecommendationKind, string>>;

const KINDS: ReadonlySet<string> = new Set<RecommendationKind>([
  'protein',
  'fiber',
  'carbs_training',
  'post_training',
  'next_level',
  'muscle_deficit',
  'rest_day',
  'deload',
  'weight',
  'measurements',
  'checkin',
]);

export function dismissalsKey(userId: string): string {
  return `recommendations.dismissed.${userId}`;
}

/** Unknown kinds and broken timestamps are dropped; broken JSON reads as empty. */
export function parseDismissals(raw: string | null | undefined): RecommendationDismissals {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: RecommendationDismissals = {};
    for (const [kind, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (KINDS.has(kind) && typeof value === 'string' && Number.isFinite(Date.parse(value))) {
        out[kind as RecommendationKind] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readDismissals(storage: StringKvStorage, userId: string): RecommendationDismissals {
  try {
    return parseDismissals(storage.getString(dismissalsKey(userId)));
  } catch {
    return {};
  }
}

/** Stores the dismissal and returns the new map. */
export function writeDismissal(
  storage: StringKvStorage,
  userId: string,
  kind: RecommendationKind,
  at: Date,
): RecommendationDismissals {
  const next = { ...readDismissals(storage, userId), [kind]: at.toISOString() };
  try {
    storage.set(dismissalsKey(userId), JSON.stringify(next));
  } catch {
    // Worst case the card comes back on the next start.
  }
  return next;
}
