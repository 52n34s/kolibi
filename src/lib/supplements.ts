import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

/** ISO weekday: 1 = Monday … 7 = Sunday (matches Postgres extract(isodow)). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ScheduleKind = 'daily' | 'interval' | 'weekdays';

export type DoseUnit = 'µg' | 'mg' | 'g' | 'IE' | 'capsule' | 'tablet';

export const DOSE_UNITS: DoseUnit[] = ['µg', 'mg', 'g', 'IE', 'capsule', 'tablet'];

export type Supplement = {
  id: string;
  user_id: string;
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_kind: ScheduleKind;
  interval_days: number | null;
  weekdays: number[] | null;
  start_date: string;
  cycle_on_days: number | null;
  cycle_off_days: number | null;
  cycle_anchor_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SupplementIntake = {
  id: string;
  user_id: string;
  supplement_id: string;
  taken_at: string;
  logged_on: string;
  created_at: string;
};

export type SupplementReminder = {
  id: string;
  user_id: string;
  label: string | null;
  remind_at: string;
  is_enabled: boolean;
  created_at: string;
};

export type SupplementReminderWithItems = SupplementReminder & {
  supplement_ids: string[];
};

export type SupplementReminderWriteInput = {
  label: string | null;
  remind_at: string;
  is_enabled: boolean;
  supplement_ids: string[];
};

export const MAX_SUPPLEMENT_REMINDERS = 3;

export class SupplementReminderLimitError extends Error {
  constructor() {
    super('Maximal 3 Erinnerungen pro Nutzer');
    this.name = 'SupplementReminderLimitError';
  }
}

function isReminderLimitError(error: unknown): boolean {
  if (!(error && typeof error === 'object')) {
    return false;
  }

  const message =
    'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  return message.includes('Maximal 3 Erinnerungen pro Nutzer');
}

export type SupplementForDay = {
  id: string;
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  is_due: boolean;
  taken: boolean;
  sort_order: number;
};

export type SupplementWriteInput = {
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_kind: ScheduleKind;
  interval_days: number | null;
  weekdays: number[] | null;
  start_date: string;
  cycle_on_days: number | null;
  cycle_off_days: number | null;
  cycle_anchor_date: string | null;
  is_active: boolean;
  sort_order?: number;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

function mapSupplementRow(row: Record<string, unknown>): Supplement {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    dose_amount: row.dose_amount == null ? null : Number(row.dose_amount),
    dose_unit: row.dose_unit == null ? null : String(row.dose_unit),
    schedule_kind: row.schedule_kind as ScheduleKind,
    interval_days: row.interval_days == null ? null : Number(row.interval_days),
    weekdays: Array.isArray(row.weekdays)
      ? row.weekdays.map((day) => Number(day))
      : null,
    start_date: String(row.start_date),
    cycle_on_days: row.cycle_on_days == null ? null : Number(row.cycle_on_days),
    cycle_off_days: row.cycle_off_days == null ? null : Number(row.cycle_off_days),
    cycle_anchor_date:
      row.cycle_anchor_date == null ? null : String(row.cycle_anchor_date),
    is_active: row.is_active === true,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const SUPPLEMENT_SELECT =
  'id, user_id, name, dose_amount, dose_unit, schedule_kind, interval_days, weekdays, start_date, cycle_on_days, cycle_off_days, cycle_anchor_date, is_active, sort_order, created_at, updated_at';

export async function fetchSupplements(userId: string): Promise<Supplement[]> {
  const { data, error } = await supabase
    .from('supplements')
    .select(SUPPLEMENT_SELECT)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSupplementRow(row as Record<string, unknown>));
}

export async function fetchSupplementsForDay(date: string): Promise<SupplementForDay[]> {
  const { data, error } = await supabase.rpc('supplements_for_day', { p_date: date });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    dose_amount: number | string | null;
    dose_unit: string | null;
    is_due: boolean;
    taken: boolean;
    sort_order: number;
  }>;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    dose_amount: row.dose_amount == null ? null : Number(row.dose_amount),
    dose_unit: row.dose_unit == null ? null : String(row.dose_unit),
    is_due: row.is_due === true,
    taken: row.taken === true,
    sort_order: Number(row.sort_order ?? 0),
  }));
}

/**
 * Upsert intake for a calendar day.
 * `logged_on` is always the local date key — never derived from `now()`.
 */
export async function logIntake(supplementId: string, date: string): Promise<void> {
  const loggedOn = localDateKey(parseDateOnly(date));
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase.from('supplement_intakes').upsert(
    {
      user_id: user.id,
      supplement_id: supplementId,
      logged_on: loggedOn,
      taken_at: new Date().toISOString(),
    },
    { onConflict: 'supplement_id,logged_on' },
  );

  if (error) {
    throw error;
  }
}

export async function removeIntake(supplementId: string, date: string): Promise<void> {
  const loggedOn = localDateKey(parseDateOnly(date));
  const { error } = await supabase
    .from('supplement_intakes')
    .delete()
    .eq('supplement_id', supplementId)
    .eq('logged_on', loggedOn);

  if (error) {
    throw error;
  }
}

export async function createSupplement(
  userId: string,
  input: SupplementWriteInput,
): Promise<Supplement> {
  const { data, error } = await supabase
    .from('supplements')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      dose_amount: input.dose_amount,
      dose_unit: input.dose_unit,
      schedule_kind: input.schedule_kind,
      interval_days: input.interval_days,
      weekdays: input.weekdays,
      start_date: input.start_date,
      cycle_on_days: input.cycle_on_days,
      cycle_off_days: input.cycle_off_days,
      cycle_anchor_date: input.cycle_anchor_date,
      is_active: input.is_active,
      sort_order: input.sort_order ?? 0,
    })
    .select(SUPPLEMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapSupplementRow(data as Record<string, unknown>);
}

export async function updateSupplement(
  id: string,
  input: SupplementWriteInput,
): Promise<Supplement> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    dose_amount: input.dose_amount,
    dose_unit: input.dose_unit,
    schedule_kind: input.schedule_kind,
    interval_days: input.interval_days,
    weekdays: input.weekdays,
    start_date: input.start_date,
    cycle_on_days: input.cycle_on_days,
    cycle_off_days: input.cycle_off_days,
    cycle_anchor_date: input.cycle_anchor_date,
    is_active: input.is_active,
    updated_at: new Date().toISOString(),
  };

  if (input.sort_order != null) {
    payload.sort_order = input.sort_order;
  }

  const { data, error } = await supabase
    .from('supplements')
    .update(payload)
    .eq('id', id)
    .select(SUPPLEMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapSupplementRow(data as Record<string, unknown>);
}

export async function deleteSupplement(id: string): Promise<void> {
  const { error } = await supabase.from('supplements').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

function mapReminderRow(row: Record<string, unknown>): SupplementReminder {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    label: row.label == null ? null : String(row.label),
    remind_at: String(row.remind_at),
    is_enabled: row.is_enabled === true,
    created_at: String(row.created_at),
  };
}

/** Normalize Postgres `time` / picker output to HH:MM:SS. */
export function normalizeRemindAt(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return '08:00:00';
  }

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  const seconds = match[3] != null ? Math.min(59, Math.max(0, Number(match[3]))) : 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatRemindAtLabel(value: string): string {
  const normalized = normalizeRemindAt(value);
  return normalized.slice(0, 5);
}

export async function fetchSupplementReminders(
  userId: string,
): Promise<SupplementReminderWithItems[]> {
  const { data: reminderRows, error: remindersError } = await supabase
    .from('supplement_reminders')
    .select('id, user_id, label, remind_at, is_enabled, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (remindersError) {
    throw remindersError;
  }

  const reminders = (reminderRows ?? []).map((row) =>
    mapReminderRow(row as Record<string, unknown>),
  );

  if (reminders.length === 0) {
    return [];
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('supplement_reminder_items')
    .select('reminder_id, supplement_id')
    .in(
      'reminder_id',
      reminders.map((reminder) => reminder.id),
    );

  if (itemsError) {
    throw itemsError;
  }

  const idsByReminder = new Map<string, string[]>();
  for (const row of itemRows ?? []) {
    const reminderId = String((row as { reminder_id: string }).reminder_id);
    const supplementId = String((row as { supplement_id: string }).supplement_id);
    const list = idsByReminder.get(reminderId) ?? [];
    list.push(supplementId);
    idsByReminder.set(reminderId, list);
  }

  return reminders.map((reminder) => ({
    ...reminder,
    supplement_ids: idsByReminder.get(reminder.id) ?? [],
  }));
}

async function replaceReminderItems(
  reminderId: string,
  supplementIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('supplement_reminder_items')
    .delete()
    .eq('reminder_id', reminderId);

  if (deleteError) {
    throw deleteError;
  }

  const uniqueIds = [...new Set(supplementIds)];
  if (uniqueIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('supplement_reminder_items').insert(
    uniqueIds.map((supplementId) => ({
      reminder_id: reminderId,
      supplement_id: supplementId,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function createSupplementReminder(
  userId: string,
  input: SupplementReminderWriteInput,
): Promise<SupplementReminderWithItems> {
  const { data, error } = await supabase
    .from('supplement_reminders')
    .insert({
      user_id: userId,
      label: input.label?.trim() ? input.label.trim() : null,
      remind_at: normalizeRemindAt(input.remind_at),
      is_enabled: input.is_enabled,
    })
    .select('id, user_id, label, remind_at, is_enabled, created_at')
    .single();

  if (error) {
    if (isReminderLimitError(error)) {
      throw new SupplementReminderLimitError();
    }
    throw error;
  }

  const reminder = mapReminderRow(data as Record<string, unknown>);

  try {
    await replaceReminderItems(reminder.id, input.supplement_ids);
  } catch (itemsError) {
    await supabase.from('supplement_reminders').delete().eq('id', reminder.id);
    throw itemsError;
  }

  return { ...reminder, supplement_ids: [...new Set(input.supplement_ids)] };
}

export async function updateSupplementReminder(
  id: string,
  input: SupplementReminderWriteInput,
): Promise<SupplementReminderWithItems> {
  const { data, error } = await supabase
    .from('supplement_reminders')
    .update({
      label: input.label?.trim() ? input.label.trim() : null,
      remind_at: normalizeRemindAt(input.remind_at),
      is_enabled: input.is_enabled,
    })
    .eq('id', id)
    .select('id, user_id, label, remind_at, is_enabled, created_at')
    .single();

  if (error) {
    throw error;
  }

  const reminder = mapReminderRow(data as Record<string, unknown>);
  await replaceReminderItems(reminder.id, input.supplement_ids);
  return { ...reminder, supplement_ids: [...new Set(input.supplement_ids)] };
}

export async function setSupplementReminderEnabled(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('supplement_reminders')
    .update({ is_enabled: isEnabled })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function deleteSupplementReminder(id: string): Promise<void> {
  const { error } = await supabase.from('supplement_reminders').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

/** First calendar day of a pause after the on-block starting at cycle_anchor_date. */
export function cyclePauseStartDate(s: {
  cycle_on_days: number | null;
  cycle_anchor_date: string | null;
}): Date | null {
  if (s.cycle_on_days == null || s.cycle_anchor_date == null) {
    return null;
  }

  const start = parseDateOnly(s.cycle_anchor_date);
  start.setDate(start.getDate() + s.cycle_on_days);
  return start;
}

function describeWeekdays(weekdays: number[], t: Translate): string {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return t(`supplements.schedule.weekdayOnly.${sorted[0]}`);
  }

  return sorted.map((day) => t(`supplements.schedule.weekdayShort.${day}`)).join(', ');
}

function describeBaseSchedule(s: Supplement, t: Translate): string {
  if (s.schedule_kind === 'daily') {
    return t('supplements.schedule.daily');
  }

  if (s.schedule_kind === 'interval') {
    const days = s.interval_days ?? 2;
    return t('supplements.schedule.everyNDays', { count: days });
  }

  return describeWeekdays(s.weekdays ?? [], t);
}

function describeCycleSuffix(s: Supplement, t: Translate): string | null {
  if (
    s.cycle_on_days == null ||
    s.cycle_off_days == null ||
    !(s.cycle_on_days > 0) ||
    !(s.cycle_off_days > 0)
  ) {
    return null;
  }

  const weeksOn = Math.round(s.cycle_on_days / 7);
  const weeksOff = Math.round(s.cycle_off_days / 7);
  return t('supplements.schedule.cycleSuffix', { weeksOn, weeksOff });
}

/** Human-readable schedule for list/detail UI. */
export function describeSchedule(s: Supplement, t: Translate): string {
  const base = describeBaseSchedule(s, t);
  const cycle = describeCycleSuffix(s, t);
  return cycle ? `${base}${t('supplements.schedule.cycleJoin')}${cycle}` : base;
}

export function formatDoseLabel(
  amount: number | null,
  unit: string | null,
  t: Translate,
): string | null {
  if (amount == null) {
    return null;
  }

  const unitLabel =
    unit === 'capsule' || unit === 'tablet' || unit === 'Kapsel' || unit === 'Tablette'
      ? t(
          unit === 'tablet' || unit === 'Tablette'
            ? 'supplements.units.tablet'
            : 'supplements.units.capsule',
        )
      : (unit ?? '');

  const rounded =
    Number.isInteger(amount) || Math.abs(amount - Math.round(amount)) < 1e-9
      ? String(Math.round(amount))
      : String(amount);

  return unitLabel ? `${rounded} ${unitLabel}` : rounded;
}
