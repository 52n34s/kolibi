import type { GoalCategory } from './goal-category';

/** Sections of the Today tab below the check-in and the recommendations. */
export type TodaySection = 'training' | 'nutrition' | 'body';

/**
 * Weighting by goal: losing weight puts calories and weight first; muscle and
 * strength put training, protein and the build-up view first. Everything else
 * keeps the default order training → nutrition → body.
 */
export function todaySectionOrder(goal: GoalCategory | null): TodaySection[] {
  switch (goal) {
    case 'lose':
      return ['nutrition', 'body', 'training'];
    case 'muscle':
    case 'strength':
      return ['training', 'nutrition', 'body'];
    default:
      return ['training', 'nutrition', 'body'];
  }
}

/**
 * Sections Today shows. While a unit runs, the banner "Training läuft · …
 * Weiter geht's" sits at the top of every tab and leads back into it, so the
 * training card (next unit / done) would only repeat it with stale content.
 */
export function visibleTodaySections(
  goal: GoalCategory | null,
  options: { sessionBannerShown: boolean },
): TodaySection[] {
  const order = todaySectionOrder(goal);
  return options.sessionBannerShown ? order.filter((section) => section !== 'training') : order;
}

/** Which body card Today shows: the weight card for weight goals, the build-up card for muscle and strength. */
export function todayBodyCard(goal: GoalCategory | null): 'weight' | 'buildUp' {
  return goal === 'muscle' || goal === 'strength' ? 'buildUp' : 'weight';
}

/**
 * Compact nutrition line: kcal left (never below zero, "über dem Ziel" is a
 * separate state) and protein eaten against the target.
 */
export function todayNutritionSummary(params: {
  kcalTarget: number | null;
  kcalEaten: number;
  proteinTarget: number | null;
  proteinEaten: number;
}): { kcalLeft: number | null; kcalOver: number | null; proteinEaten: number; proteinTarget: number | null } {
  const eaten = Math.max(0, Math.round(params.kcalEaten));
  const target = params.kcalTarget != null && params.kcalTarget > 0 ? Math.round(params.kcalTarget) : null;
  return {
    kcalLeft: target != null ? Math.max(0, target - eaten) : null,
    kcalOver: target != null && eaten > target ? eaten - target : null,
    proteinEaten: Math.max(0, Math.round(params.proteinEaten)),
    proteinTarget:
      params.proteinTarget != null && params.proteinTarget > 0 ? Math.round(params.proteinTarget) : null,
  };
}

/**
 * Training state for Today. 'rest' only when the plan uses weekdays and none
 * is set for today; a rotating plan always has a next unit.
 */
export function todayTrainingState(params: {
  units: readonly { weekdays: readonly number[] }[];
  sessions: readonly { loggedOn: string }[];
  todayKey: string;
  todayWeekday: number;
}): 'none' | 'done' | 'rest' | 'next' {
  if (params.units.length === 0) {
    return 'none';
  }
  if (params.sessions.some((session) => session.loggedOn === params.todayKey)) {
    return 'done';
  }
  const usesWeekdays = params.units.some((unit) => unit.weekdays.length > 0);
  const scheduledToday = params.units.some((unit) => unit.weekdays.includes(params.todayWeekday));
  return usesWeekdays && !scheduledToday ? 'rest' : 'next';
}
