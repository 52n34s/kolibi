/**
 * training_sessions rows next to Kolibi units (workout_sessions).
 *
 * Finishing a unit writes one strength row and links it via
 * workout_sessions.training_session_id. A finish that ran twice, or a link
 * that never landed, leaves a strength row without a link; export and energy
 * then showed it as "Manuell · Krafttraining" and counted it a second time.
 *
 * `is_manual` (20260927102000) says it outright: rows written by hand carry
 * it, a unit's own row does not, and the migration backfilled the old ones.
 * A true manual entry therefore counts on every day, also next to a unit.
 *
 * Per day:
 * - linked rows belong to their unit;
 * - is_manual rows are manual entries, whatever else happened that day;
 * - a finished unit without a link adopts one unlinked strength row
 *   (its own row whose link got lost);
 * - further unlinked strength rows without is_manual are duplicates: never
 *   counted, never shown;
 * - everything else is a manual entry.
 *
 * Without the migration `isManual` is undefined and the old rules apply: an
 * unlinked strength row on a day without a finished unit is a manual entry.
 */

type RowLike = {
  id: string;
  loggedOn: string;
  activity: string;
  /** undefined before the is_manual migration. */
  isManual?: boolean;
};
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
    if (row.isManual === true || row.activity !== 'strength') {
      kept.push(row);
      manual.push(row);
      continue;
    }
    if (row.isManual === undefined && !finishedUnitsByDay.has(row.loggedOn)) {
      kept.push(row);
      manual.push(row);
      continue;
    }
    // A unit's own row: it counts once, as that unit — adopted when the link
    // got lost, a duplicate beyond that.
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
