import { createSchemaProbe } from '@/lib/db-schema-errors';
import { supabase } from '@/lib/supabase';
import {
  isCompleteCheckin,
  type CheckinAnswers,
  type DailyCheckin,
} from '@/lib/checkin/readiness';

/**
 * daily_checkins and the two profile columns come from
 * 20260926170000_daily_checkins.sql. Until it ran, the check-in stays hidden.
 */
const probeCheckinTable = createSchemaProbe(() =>
  supabase.from('daily_checkins').select('id').limit(0),
);
const probeCheckinProfileColumns = createSchemaProbe(() =>
  supabase.from('profiles').select('checkin_enabled, checkin_reminder_time').limit(0),
);

export async function isCheckinAvailable(): Promise<boolean> {
  const [table, columns] = await Promise.all([probeCheckinTable(), probeCheckinProfileColumns()]);
  return table && columns;
}

export type CheckinSettings = {
  /** false until the migration ran — everything check-in related stays hidden. */
  available: boolean;
  enabled: boolean;
  /** "HH:MM:SS" or null = reminder off. */
  reminderTime: string | null;
};

export const UNAVAILABLE_CHECKIN_SETTINGS: CheckinSettings = {
  available: false,
  enabled: false,
  reminderTime: null,
};

export async function fetchCheckinSettings(userId: string): Promise<CheckinSettings> {
  if (!(await isCheckinAvailable())) {
    return UNAVAILABLE_CHECKIN_SETTINGS;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('checkin_enabled, checkin_reminder_time')
    .eq('id', userId)
    .maybeSingle<{ checkin_enabled: boolean | null; checkin_reminder_time: string | null }>();
  if (error) {
    throw error;
  }
  return {
    available: true,
    enabled: data?.checkin_enabled ?? true,
    reminderTime: data?.checkin_reminder_time ?? null,
  };
}

export async function updateCheckinSettings(
  userId: string,
  patch: { enabled?: boolean; reminderTime?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.enabled !== undefined) {
    row.checkin_enabled = patch.enabled;
  }
  if (patch.reminderTime !== undefined) {
    row.checkin_reminder_time = patch.reminderTime;
  }
  if (Object.keys(row).length === 0) {
    return;
  }
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) {
    throw error;
  }
}

type CheckinRow = {
  checkin_date: string;
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
};

/** Check-ins from sinceKey on (inclusive), newest first. Empty before the migration. */
export async function fetchRecentCheckins(
  userId: string,
  sinceKey: string,
): Promise<DailyCheckin[]> {
  if (!(await probeCheckinTable())) {
    return [];
  }
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('checkin_date, sleep, energy, soreness, stress')
    .eq('user_id', userId)
    .gte('checkin_date', sinceKey)
    .order('checkin_date', { ascending: false })
    .limit(31);
  if (error) {
    throw error;
  }
  return ((data ?? []) as CheckinRow[])
    .map((row) => ({
      date: row.checkin_date,
      sleep: row.sleep,
      energy: row.energy,
      soreness: row.soreness,
      stress: row.stress,
    }))
    .filter((entry) => isCompleteCheckin(entry));
}

/** One row per day; answering again the same day updates it. */
export async function saveCheckin(
  userId: string,
  dateKey: string,
  answers: CheckinAnswers,
): Promise<void> {
  const { error } = await supabase.from('daily_checkins').upsert(
    {
      user_id: userId,
      checkin_date: dateKey,
      sleep: answers.sleep,
      energy: answers.energy,
      soreness: answers.soreness,
      stress: answers.stress,
    },
    { onConflict: 'user_id,checkin_date' },
  );
  if (error) {
    throw error;
  }
}
