/**
 * When the morning check-in card shows, and what "today's check-in" means for
 * other screens. Pure; the hooks feed in storage and profile values.
 */

/**
 * answered: saved for today.
 * skipped: "Heute nicht" today.
 * open: still to answer (also after the card's morning window).
 * disabled: "Nicht mehr anzeigen", or the check-in migration has not run yet.
 */
export type TodayCheckinStatus = 'answered' | 'skipped' | 'open' | 'disabled';

/** The card is offered until this local hour (exclusive). */
export const CHECKIN_CARD_UNTIL_HOUR = 12;

/** Default reminder time when the reminder is switched on. */
export const CHECKIN_DEFAULT_REMINDER_TIME = '07:00:00';

export function resolveTodayCheckinStatus(params: {
  available: boolean;
  enabled: boolean;
  answeredToday: boolean;
  skippedOn: string | null | undefined;
  todayKey: string;
}): TodayCheckinStatus {
  if (!params.available) {
    return 'disabled';
  }
  // An answer given today still counts even when the card was switched off later.
  if (params.answeredToday) {
    return 'answered';
  }
  if (!params.enabled) {
    return 'disabled';
  }
  if (params.skippedOn === params.todayKey) {
    return 'skipped';
  }
  return 'open';
}

export type CheckinCardMode = 'questions' | 'result' | 'hidden';

/**
 * questions: open and still morning (before CHECKIN_CARD_UNTIL_HOUR).
 * result: answered today — one line with the outcome, for the rest of the day.
 * hidden: everything else. Never a pop-up: this only drives an inline card.
 */
export function checkinCardMode(status: TodayCheckinStatus, now: Date): CheckinCardMode {
  if (status === 'answered') {
    return 'result';
  }
  if (status === 'open' && now.getHours() < CHECKIN_CARD_UNTIL_HOUR) {
    return 'questions';
  }
  return 'hidden';
}

/** "HH:MM" or "HH:MM:SS" (Postgres time) → hour/minute; null when not a valid time. */
export function parseReminderTime(
  value: string | null | undefined,
): { hour: number; minute: number } | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

/** hour/minute → "HH:MM:00" for the profile column. */
export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/** "HH:MM" for display. */
export function reminderTimeLabel(value: string | null | undefined): string {
  const parsed = parseReminderTime(value);
  if (!parsed) {
    return '';
  }
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
}
