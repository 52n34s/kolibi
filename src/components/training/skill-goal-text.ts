import {
  isSamePeriodEdge,
  type PeriodEdge,
  type SkillGoalForecast,
  type SkillGoalPeriod,
} from '@/lib/workouts/skill-goal-forecast';
import type { ExerciseKind } from '@/lib/workouts/types';

type T = (key: string, options?: Record<string, unknown>) => string;

function monthLabel(edge: PeriodEdge, lang: string, thisYear: number): string {
  const date = new Date(edge.year, edge.month, 15);
  const options: Intl.DateTimeFormatOptions =
    edge.year === thisYear ? { month: 'long' } : { month: 'long', year: 'numeric' };
  try {
    return date.toLocaleDateString(lang, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

/** "voraussichtlich Mitte bis Ende November" / "likely mid to late November". */
export function formatSkillGoalPeriod(
  period: SkillGoalPeriod,
  t: T,
  lang: string,
  thisYear = new Date().getFullYear(),
): string {
  const { from, to } = period;
  if (isSamePeriodEdge(from, to)) {
    return t('skillGoal.period.single', {
      part: t(`skillGoal.part.${from.part}`),
      month: monthLabel(from, lang, thisYear),
    });
  }
  if (from.month === to.month && from.year === to.year) {
    return t('skillGoal.period.sameMonth', {
      from: t(`skillGoal.part.${from.part}`),
      to: t(`skillGoal.part.${to.part}`),
      month: monthLabel(to, lang, thisYear),
    });
  }
  return t('skillGoal.period.range', {
    fromPart: t(`skillGoal.part.${from.part}`),
    fromMonth: monthLabel(from, lang, thisYear),
    toPart: t(`skillGoal.part.${to.part}`),
    toMonth: monthLabel(to, lang, thisYear),
  });
}

export function formatSkillGoalTarget(value: number, kind: ExerciseKind, t: T): string {
  return kind === 'time'
    ? t('skillGoal.targetSeconds', { value })
    : t('skillGoal.targetReps', { value });
}

export function formatSkillGoalCurrent(
  value: number,
  kind: ExerciseKind,
  otherRungName: string | null,
  t: T,
): string {
  if (otherRungName) {
    return kind === 'time'
      ? t('skillGoal.currentSecondsOn', { value, name: otherRungName })
      : t('skillGoal.currentRepsOn', { value, name: otherRungName });
  }
  return kind === 'time'
    ? t('skillGoal.currentSeconds', { value })
    : t('skillGoal.currentReps', { value });
}

/** Period, or the honest hint when there is no date to show. */
export function formatSkillGoalStatus(forecast: SkillGoalForecast, t: T, lang: string): string {
  switch (forecast.status) {
    case 'ok':
      return formatSkillGoalPeriod(forecast.period, t, lang);
    case 'achieved':
      return t('skillGoal.achieved');
    case 'beyond_year':
      return t('skillGoal.beyondYear');
    case 'no_trend':
      return t('skillGoal.noTrend');
    case 'too_little_data':
      if (forecast.current == null) {
        return t('skillGoal.start');
      }
      return forecast.sessionsNeeded > 0
        ? t('skillGoal.tooLittleSessions', { count: forecast.sessionsNeeded })
        : t('skillGoal.tooLittleDays', { count: Math.max(1, forecast.daysNeeded) });
  }
}
