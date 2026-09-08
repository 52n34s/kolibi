import { localDateKey, parseDateOnly } from '@/lib/day-window';
import {
  calculateTrainingCalories,
  isTrainingActivity,
  isTrainingIntensity,
  type TrainingActivity,
  type TrainingIntensity,
} from '@/lib/training-calories';
import { supabase } from '@/lib/supabase';

export type TrainingKcalSource = 'estimated' | 'manual';

export type TrainingSession = {
  id: string;
  userId: string;
  loggedOn: string;
  activity: TrainingActivity;
  durationMinutes: number;
  intensity: TrainingIntensity;
  weightKg: number;
  kcal: number;
  kcalSource: TrainingKcalSource;
};

type TrainingSessionRow = {
  id: string;
  user_id: string;
  logged_on: string;
  activity: string;
  duration_minutes: number;
  intensity: string;
  weight_kg: number;
  kcal: number;
  kcal_source: string | null;
};

function isTrainingKcalSource(value: string | null | undefined): value is TrainingKcalSource {
  return value === 'estimated' || value === 'manual';
}

function mapRow(row: TrainingSessionRow): TrainingSession {
  if (!isTrainingActivity(row.activity)) {
    throw new Error(`Invalid training activity: ${row.activity}`);
  }
  if (!isTrainingIntensity(row.intensity)) {
    throw new Error(`Invalid training intensity: ${row.intensity}`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    loggedOn: row.logged_on,
    activity: row.activity,
    durationMinutes: row.duration_minutes,
    intensity: row.intensity,
    weightKg: Number(row.weight_kg),
    kcal: row.kcal,
    kcalSource: isTrainingKcalSource(row.kcal_source) ? row.kcal_source : 'estimated',
  };
}

const TRAINING_SESSION_SELECT =
  'id, user_id, logged_on, activity, duration_minutes, intensity, weight_kg, kcal, kcal_source';

/** Monday–Sunday local date keys for the week containing `now`. */
export function localWeekDateKeys(now: Date = new Date()): string[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay(); // 0 = Sunday
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysSinceMonday);

  const keys: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    keys.push(localDateKey(day));
  }
  return keys;
}

export async function fetchTrainingSessionsForWeek(
  userId: string,
  now: Date = new Date(),
): Promise<TrainingSession[]> {
  const keys = localWeekDateKeys(now);
  const { data, error } = await supabase
    .from('training_sessions')
    .select(TRAINING_SESSION_SELECT)
    .eq('user_id', userId)
    .gte('logged_on', keys[0])
    .lte('logged_on', keys[6])
    .order('logged_on', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrainingSessionRow[]).map(mapRow);
}

export async function fetchTrainingSessionForDate(
  userId: string,
  loggedOn: string,
): Promise<TrainingSession | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(TRAINING_SESSION_SELECT)
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .maybeSingle<TrainingSessionRow>();

  if (error) {
    throw error;
  }

  return data ? mapRow(data) : null;
}

export async function upsertTrainingSession(params: {
  userId: string;
  loggedOn: string;
  activity: TrainingActivity;
  durationMinutes: number;
  intensity: TrainingIntensity;
  weightKg: number;
  /** When set and > 0, stored as manual kcal; otherwise MET estimate. */
  manualKcal?: number | null;
}): Promise<TrainingSession> {
  const estimatedKcal = calculateTrainingCalories({
    activity: params.activity,
    weightKg: params.weightKg,
    durationMinutes: params.durationMinutes,
    intensity: params.intensity,
  });

  const manual =
    params.manualKcal != null &&
    Number.isFinite(params.manualKcal) &&
    params.manualKcal > 0
      ? Math.round(params.manualKcal)
      : null;

  const kcal = manual ?? estimatedKcal;
  const kcalSource: TrainingKcalSource = manual != null ? 'manual' : 'estimated';

  const { data, error } = await supabase
    .from('training_sessions')
    .upsert(
      {
        user_id: params.userId,
        logged_on: params.loggedOn,
        activity: params.activity,
        duration_minutes: params.durationMinutes,
        intensity: params.intensity,
        weight_kg: params.weightKg,
        kcal,
        kcal_source: kcalSource,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,logged_on' },
    )
    .select(TRAINING_SESSION_SELECT)
    .single<TrainingSessionRow>();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

export async function deleteTrainingSessionForDate(
  userId: string,
  loggedOn: string,
): Promise<void> {
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('logged_on', loggedOn);

  if (error) {
    throw error;
  }
}

export function weekDotFlags(
  sessions: TrainingSession[],
  now: Date = new Date(),
): boolean[] {
  const keys = localWeekDateKeys(now);
  const logged = new Set(sessions.map((session) => session.loggedOn));
  return keys.map((key) => logged.has(key));
}

/** Clamp selectable training log date to roughly the current local week (Mon–today). */
export function isTrainingLogDateAllowed(dateKey: string, now: Date = new Date()): boolean {
  const keys = localWeekDateKeys(now);
  const today = localDateKey(now);
  const date = parseDateOnly(dateKey);
  const todayDate = parseDateOnly(today);
  if (date.getTime() > todayDate.getTime()) {
    return false;
  }
  return keys.includes(dateKey);
}
