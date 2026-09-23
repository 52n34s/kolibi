import type { WorkoutSession, WorkoutTemplate } from '@/lib/workouts/types';

/** ISO weekday 1 = Monday … 7 = Sunday from a Date or YYYY-MM-DD key. */
export function isoWeekdayFromDate(date: Date): number {
  const day = date.getDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

export function isoWeekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return isoWeekdayFromDate(new Date(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

type SessionLike = Pick<WorkoutSession, 'templateId' | 'loggedOn' | 'finishedAt' | 'startedAt'>;

/**
 * Pick the next template to suggest:
 * 1) Unit scheduled for today that was not done today
 * 2) Else the unit after the most recently finished (by position, cyclic)
 * 3) Else the first by position
 *
 * Callers pass templates from fetchTemplates, which already excludes archived
 * rows (`archived_at IS NULL`). No extra archive filter here.
 */
export function pickNextTemplate(
  templates: readonly WorkoutTemplate[],
  lastSessions: readonly SessionLike[],
  todayKey: string,
): WorkoutTemplate | null {
  if (templates.length === 0) {
    return null;
  }

  const ordered = [...templates].sort((a, b) => a.position - b.position);
  const todayWeekday = isoWeekdayFromDateKey(todayKey);
  const doneToday = new Set(
    lastSessions
      .filter((session) => session.loggedOn === todayKey && session.templateId != null)
      .map((session) => session.templateId as string),
  );

  const scheduledToday = ordered.find(
    (template) =>
      template.weekdays.includes(todayWeekday) && !doneToday.has(template.id),
  );
  if (scheduledToday) {
    return scheduledToday;
  }

  const finished = [...lastSessions]
    .filter((session) => session.finishedAt != null && session.templateId != null)
    .sort((a, b) => {
      const aAt = a.finishedAt ?? a.startedAt;
      const bAt = b.finishedAt ?? b.startedAt;
      return bAt.localeCompare(aAt);
    });

  const lastTemplateId = finished[0]?.templateId ?? null;
  if (lastTemplateId != null) {
    const index = ordered.findIndex((template) => template.id === lastTemplateId);
    if (index >= 0) {
      return ordered[(index + 1) % ordered.length] ?? ordered[0]!;
    }
  }

  return ordered[0]!;
}
