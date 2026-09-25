import type { ReadinessResult } from '@/lib/checkin/readiness';
import { pickNextTemplate } from '@/lib/workouts/next-template';
import { hasClearReserve, type ProgressionHistoryUnit, type ProgressionSuggestion } from '@/lib/workouts/progression';
import type { ProgressionEventKind, WorkoutSession, WorkoutTemplate } from '@/lib/workouts/types';

/**
 * How the daily readiness (morning check-in) steers progression and the
 * "Als Nächstes" unit. No readiness, or no check-in and nothing in the data,
 * leaves everything as before.
 */

export type ReadinessGate = Pick<ReadinessResult, 'level' | 'basis' | 'signals' | 'alternativeUnitId'>;

/** Units at most this share of the planned unit's sets count as "lighter". */
export const LIGHTER_UNIT_SETS_RATIO = 0.75;

/** True when the readiness has nothing to say and behaviour stays unchanged. */
export function isNeutralReadiness(readiness: ReadinessGate | null | undefined): boolean {
  if (readiness == null || readiness.basis === 'none') {
    return true;
  }
  // No check-in and nothing notable in the data: nothing to steer by.
  return readiness.basis === 'data' && readiness.signals.length === 0;
}

/**
 * A success that leaves no doubt: the session felt easy, or at least one set
 * had 2+ reps in reserve.
 */
export function isClearSuccess(unit: ProgressionHistoryUnit | null | undefined): boolean {
  if (unit == null) {
    return false;
  }
  return unit.intensity === 'easy' || hasClearReserve(unit);
}

/**
 * Level-ups only when "bereit", or "normal" after a clear success. "schonen"
 * holds them back for the day.
 */
export function allowsLevelUp(
  readiness: ReadinessGate | null | undefined,
  clearSuccess: boolean,
): boolean {
  if (isNeutralReadiness(readiness)) {
    return true;
  }
  if (readiness!.level === 'ready') {
    return true;
  }
  if (readiness!.level === 'normal') {
    return clearSuccess;
  }
  return false;
}

function isLevelUpKind(kind: ProgressionEventKind): boolean {
  return kind !== 'variant_down' && kind !== 'range_down';
}

/**
 * Drops a level-up suggestion the readiness does not allow today. Steps down
 * always pass. `latestUnit` is the newest history unit (the session judged).
 */
export function gateSuggestionByReadiness(
  suggestion: ProgressionSuggestion | null,
  readiness: ReadinessGate | null | undefined,
  latestUnit: ProgressionHistoryUnit | null | undefined,
): ProgressionSuggestion | null {
  if (suggestion == null || !isLevelUpKind(suggestion.kind)) {
    return suggestion;
  }
  return allowsLevelUp(readiness, isClearSuccess(latestUnit)) ? suggestion : null;
}

/**
 * alternative: a unit that spares the sore muscles (needs muscle profiles).
 * lighterUnit: another unit with clearly fewer sets.
 * lighterVariant: same unit, take it lighter today (hint only).
 */
export type NextUnitAdjustment = 'alternative' | 'lighterUnit' | 'lighterVariant';

export type NextUnitPick = {
  template: WorkoutTemplate | null;
  adjustment: NextUnitAdjustment | null;
  /** The unit the plan would have suggested, when a different one was picked. */
  plannedTemplate: WorkoutTemplate | null;
};

type SessionLike = Pick<WorkoutSession, 'templateId' | 'loggedOn' | 'finishedAt' | 'startedAt'>;

export function totalTargetSets(template: WorkoutTemplate): number {
  return template.exercises.reduce((acc, exercise) => acc + Math.max(0, exercise.targetSets), 0);
}

/**
 * pickNextTemplate, then — only on a "schonen" day — a more fitting unit:
 * the readiness' alternative, else a unit with at most 75 % of the sets,
 * else the same unit with the hint to go lighter.
 */
export function pickNextTemplateForReadiness(
  templates: readonly WorkoutTemplate[],
  lastSessions: readonly SessionLike[],
  todayKey: string,
  readiness: ReadinessGate | null | undefined,
): NextUnitPick {
  const planned = pickNextTemplate(templates, lastSessions, todayKey);
  if (planned == null || isNeutralReadiness(readiness) || readiness!.level !== 'gentle') {
    return { template: planned, adjustment: null, plannedTemplate: null };
  }

  const doneToday = new Set(
    lastSessions
      .filter((session) => session.loggedOn === todayKey && session.templateId != null)
      .map((session) => session.templateId as string),
  );
  const candidates = templates.filter(
    (template) => template.id !== planned.id && !doneToday.has(template.id),
  );

  const alternativeId = readiness!.alternativeUnitId;
  if (alternativeId != null) {
    const alternative = candidates.find((template) => template.id === alternativeId);
    if (alternative) {
      return { template: alternative, adjustment: 'alternative', plannedTemplate: planned };
    }
  }

  const plannedSets = totalTargetSets(planned);
  const lighter = candidates
    .filter((template) => {
      const sets = totalTargetSets(template);
      return sets > 0 && sets <= plannedSets * LIGHTER_UNIT_SETS_RATIO;
    })
    .sort((a, b) => totalTargetSets(a) - totalTargetSets(b) || a.position - b.position)[0];
  if (lighter) {
    return { template: lighter, adjustment: 'lighterUnit', plannedTemplate: planned };
  }

  return { template: planned, adjustment: 'lighterVariant', plannedTemplate: null };
}
