/**
 * training_sessions rows next to Kolibi units (workout_sessions).
 *
 * Finishing a unit writes one strength row and links it via
 * workout_sessions.training_session_id. A finish that ran twice, or a link
 * that never landed, leaves a strength row without a link; export and energy
 * then showed it as "Manuell · Krafttraining" and counted it a second time.
 *
 * Per day:
 * - linked rows belong to their unit;
 * - a finished unit without a link adopts one unlinked strength row
 *   (its own row whose link got lost);
 * - further unlinked strength rows on a day with a finished unit are
 *   duplicates: never counted, never shown;
 * - everything else is a manual entry.
 */

type RowLike = { id: string; loggedOn: string; activity: string };
type UnitLike = {
  loggedOn: string;
  finishedAt?: string | null;
  trainingSessionId?: string | null;
};

export type ReconciledTrainingRows<T> = {
  /** Rows that count (energy, day counts): all but the duplicates. */
  kept: T[];
  /** Manual entries only: not linked to or adopted by a unit. */
  manual: T[];
  duplicates: T[];
};

export function reconcileTrainingRows<T extends RowLike>(
  rows: readonly T[],
  units: readonly UnitLike[],
): ReconciledTrainingRows<T> {
  const linkedIds = new Set<string>();
  const finishedUnitsByDay = new Map<string, number>();
  const unlinkedUnitsByDay = new Map<string, number>();
  for (const unit of units) {
    if (unit.trainingSessionId) {
      linkedIds.add(unit.trainingSessionId);
    }
    if (!unit.finishedAt) {
      continue;
    }
    finishedUnitsByDay.set(unit.loggedOn, (finishedUnitsByDay.get(unit.loggedOn) ?? 0) + 1);
    if (!unit.trainingSessionId) {
      unlinkedUnitsByDay.set(unit.loggedOn, (unlinkedUnitsByDay.get(unit.loggedOn) ?? 0) + 1);
    }
  }

  const kept: T[] = [];
  const manual: T[] = [];
  const duplicates: T[] = [];
  const adoptedByDay = new Map<string, number>();
  for (const row of rows) {
    if (linkedIds.has(row.id)) {
      kept.push(row);
      continue;
    }
    if (row.activity !== 'strength' || !finishedUnitsByDay.has(row.loggedOn)) {
      kept.push(row);
      manual.push(row);
      continue;
    }
    const adopted = adoptedByDay.get(row.loggedOn) ?? 0;
    if (adopted < (unlinkedUnitsByDay.get(row.loggedOn) ?? 0)) {
      adoptedByDay.set(row.loggedOn, adopted + 1);
      kept.push(row);
      continue;
    }
    duplicates.push(row);
  }
  return { kept, manual, duplicates };
}
