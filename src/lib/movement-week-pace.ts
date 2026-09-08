/**
 * Linear expected progress through a Mon–Sun movement week.
 * Monday → 1/7 of the weekly goal, Sunday → 7/7.
 */

/** 1 = Monday … 7 = Sunday (ISO-style). */
export function isoWeekdayIndex(now: Date = new Date()): number {
  const weekday = now.getDay(); // 0 = Sunday
  return weekday === 0 ? 7 : weekday;
}

/** Fraction of the weekly goal expected by end of today (Mon=1/7 … Sun=7/7). */
export function expectedWeeklyProgressFraction(now: Date = new Date()): number {
  return isoWeekdayIndex(now) / 7;
}

/** Absolute expected amount for a weekly goal by end of today. */
export function expectedWeeklyAmount(goal: number, now: Date = new Date()): number {
  if (!(goal > 0)) {
    return 0;
  }
  return goal * expectedWeeklyProgressFraction(now);
}
