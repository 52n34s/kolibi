import type { ExerciseKind } from './types';

/** camelCase set as queued by the sync queue / passed to upsertSessionSets. */
export type SessionSetRowInput = {
  id: string;
  sessionId: string;
  userId: string;
  exerciseId?: string | null;
  exerciseName: string;
  exercisePosition: number;
  setIndex: number;
  kind: ExerciseKind;
  perSide?: boolean;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetSeconds?: number | null;
  targetSecondsMax?: number | null;
  targetWeightKg?: number | null;
  reps?: number | null;
  seconds?: number | null;
  secondsOtherSide?: number | null;
  weightKg?: number | null;
  /** Reps in reserve (0–3, 3 = "3 or more"); only written when the column exists. */
  rir?: number | null;
  completedAt?: string;
};

export const RIR_MAX = 3;

/** 0…3 integer, anything else → null. */
export function normalizeRir(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  return value >= 0 && value <= RIR_MAX ? value : null;
}

/**
 * snake_case row for session_sets. `rir` is added only when `withRir` —
 * without the migration PostgREST rejects the row for an unknown column.
 */
export function toSessionSetRow(
  set: SessionSetRowInput,
  opts: { withRir: boolean; nowIso?: string },
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: set.id,
    session_id: set.sessionId,
    user_id: set.userId,
    exercise_id: set.exerciseId ?? null,
    exercise_name: set.exerciseName,
    exercise_position: set.exercisePosition,
    set_index: set.setIndex,
    kind: set.kind,
    per_side: set.perSide ?? false,
    target_reps: set.targetReps ?? null,
    target_reps_max: set.targetRepsMax ?? null,
    target_seconds: set.targetSeconds ?? null,
    target_seconds_max: set.targetSecondsMax ?? null,
    target_weight_kg: set.targetWeightKg ?? null,
    reps: set.reps ?? null,
    seconds: set.seconds ?? null,
    seconds_other_side: set.secondsOtherSide ?? null,
    weight_kg: set.weightKg ?? null,
    completed_at: set.completedAt ?? opts.nowIso ?? new Date().toISOString(),
  };
  if (opts.withRir) {
    row.rir = set.kind === 'time' ? null : normalizeRir(set.rir);
  }
  return row;
}
