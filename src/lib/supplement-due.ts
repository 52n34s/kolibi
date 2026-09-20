/** Local YYYY-MM-DD helpers — kept here so tests do not load react-native via day-window. */
function parseDateOnly(s: string): Date {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function localDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftLocalDateKey(dateKey: string, dayDelta: number): string {
  const date = parseDateOnly(dateKey);
  date.setDate(date.getDate() + dayDelta);
  return localDateKey(date);
}

export type SupplementDueScheduleKind = 'daily' | 'interval' | 'weekdays';

/** Fields that decide whether a supplement is due on a calendar day. */
export type SupplementDueInput = {
  is_active: boolean;
  start_date: string;
  schedule_kind: SupplementDueScheduleKind;
  interval_days: number | null;
  weekdays: number[] | null;
  cycle_on_days: number | null;
  cycle_off_days: number | null;
  cycle_anchor_date: string | null;
};

export type SupplementHistoryDay = {
  day: string;
  is_due: boolean;
  taken: boolean;
};

export type SupplementHistorySource = SupplementDueInput & {
  id: string;
  name: string;
  sort_order: number;
};

export type SupplementHistoryRow = {
  supplement_id: string;
  name: string;
  sort_order: number;
  days: SupplementHistoryDay[];
};

/** Whole local calendar days between two YYYY-MM-DD keys (DST-safe). */
function calendarDaysBetween(fromKey: string, toKey: string): number {
  const from = parseDateOnly(fromKey);
  const to = parseDateOnly(toKey);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function isoWeekdayFromKey(dateKey: string): number {
  const jsDay = parseDateOnly(dateKey).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function isCyclePauseDay(s: SupplementDueInput, dateKey: string): boolean {
  if (s.cycle_on_days == null || s.cycle_off_days == null || s.cycle_anchor_date == null) {
    return false;
  }
  if (dateKey < s.cycle_anchor_date) {
    return false;
  }
  const period = s.cycle_on_days + s.cycle_off_days;
  if (period <= 0) {
    return false;
  }
  return calendarDaysBetween(s.cycle_anchor_date, dateKey) % period >= s.cycle_on_days;
}

/**
 * Due on a local calendar day from schedule + start_date.
 * Same rules as SQL `is_supplement_due` after the start-date calendar restore:
 * daily every day from start; interval every N days from start; weekdays by ISO dow;
 * cycle off-block days are never due.
 */
export function isSupplementDue(s: SupplementDueInput, dateKey: string): boolean {
  if (!s.is_active) {
    return false;
  }
  if (dateKey < s.start_date) {
    return false;
  }
  if (isCyclePauseDay(s, dateKey)) {
    return false;
  }
  if (s.schedule_kind === 'daily') {
    return true;
  }
  if (s.schedule_kind === 'interval') {
    const interval = Math.max(1, Math.floor(s.interval_days ?? 1));
    return calendarDaysBetween(s.start_date, dateKey) % interval === 0;
  }
  if (s.schedule_kind === 'weekdays') {
    return (s.weekdays ?? []).includes(isoWeekdayFromKey(dateKey));
  }
  return false;
}

function dateKeysInclusive(fromDate: string, toDate: string): string[] {
  const keys: string[] = [];
  let key = fromDate;
  while (key <= toDate) {
    keys.push(key);
    key = shiftLocalDateKey(key, 1);
  }
  return keys;
}

/**
 * Next due calendar day for an interval schedule, counted from startDate.
 * Reuses `isSupplementDue` — not last intake. Returns `fromDate` when that day is due.
 */
export function nextIntervalIntakeDate(params: {
  startDate: string;
  intervalDays: number;
  fromDate?: string;
}): string | null {
  const interval = Math.max(1, Math.floor(params.intervalDays));
  const start = parseDateOnly(params.startDate);
  const from = parseDateOnly(params.fromDate ?? localDateKey());
  if (Number.isNaN(start.getTime()) || Number.isNaN(from.getTime())) {
    return null;
  }

  const fromKey = localDateKey(from);
  if (fromKey < params.startDate) {
    return params.startDate;
  }

  const schedule: SupplementDueInput = {
    is_active: true,
    start_date: params.startDate,
    schedule_kind: 'interval',
    interval_days: interval,
    weekdays: null,
    cycle_on_days: null,
    cycle_off_days: null,
    cycle_anchor_date: null,
  };

  for (let offset = 0; offset < interval; offset += 1) {
    const key = shiftLocalDateKey(fromKey, offset);
    if (isSupplementDue(schedule, key)) {
      return key;
    }
  }
  return null;
}

/** Due/taken per active supplement and day, from schedule + start_date (`isSupplementDue`). */
export function buildSupplementHistoryRows(
  supplements: SupplementHistorySource[],
  fromDate: string,
  toDate: string,
  takenKeys: ReadonlySet<string>,
): SupplementHistoryRow[] {
  const days = dateKeysInclusive(fromDate, toDate);
  return supplements
    .filter((item) => item.is_active)
    .map((item) => ({
      supplement_id: item.id,
      name: item.name,
      sort_order: item.sort_order,
      days: days.map((day) => ({
        day,
        is_due: isSupplementDue(item, day),
        taken: takenKeys.has(`${item.id}:${day}`),
      })),
    }))
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.name.localeCompare(b.name);
    });
}
