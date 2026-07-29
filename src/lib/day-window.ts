import * as Localization from 'expo-localization';

export function localDayWindow(d: Date = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses 'YYYY-MM-DD' as a local calendar date (not UTC midnight). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function deviceTimeZone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? 'UTC';
}

/** Recent local date keys, newest first: [today, yesterday, …]. */
export function listRecentLocalDateKeys(days: number, now: Date = new Date()): string[] {
  const keys: string[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(localDateKey(date));
  }

  return keys;
}

/** Today and yesterday are editable; older days are view-only. */
export function isDayEditable(dateKey: string, now: Date = new Date()): boolean {
  const todayKey = localDateKey(now);
  const yesterday = new Date(now);
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  return dateKey === todayKey || dateKey === localDateKey(yesterday);
}

/**
 * Timestamp for inserting a meal on a history day.
 * Today → now; past editable day → local noon of that day.
 */
export function resolveEatenAtForLocalDate(dateKey: string, now: Date = new Date()): string {
  if (dateKey === localDateKey(now)) {
    return now.toISOString();
  }

  const midday = parseDateOnly(dateKey);
  midday.setHours(12, 0, 0, 0);
  return midday.toISOString();
}
