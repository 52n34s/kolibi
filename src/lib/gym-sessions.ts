import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { calculateGymCalories, type GymIntensity } from '@/lib/gym-calories';
import { supabase } from '@/lib/supabase';

export type GymSession = {
  id: string;
  userId: string;
  loggedOn: string;
  durationMinutes: number;
  intensity: GymIntensity;
  weightKg: number;
  kcal: number;
};

type GymSessionRow = {
  id: string;
  user_id: string;
  logged_on: string;
  duration_minutes: number;
  intensity: string;
  weight_kg: number;
  kcal: number;
};

function isGymIntensity(value: string): value is GymIntensity {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

function mapRow(row: GymSessionRow): GymSession {
  if (!isGymIntensity(row.intensity)) {
    throw new Error(`Invalid gym intensity: ${row.intensity}`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    loggedOn: row.logged_on,
    durationMinutes: row.duration_minutes,
    intensity: row.intensity,
    weightKg: Number(row.weight_kg),
    kcal: row.kcal,
  };
}

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

export async function fetchGymSessionsForWeek(
  userId: string,
  now: Date = new Date(),
): Promise<GymSession[]> {
  const keys = localWeekDateKeys(now);
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('id, user_id, logged_on, duration_minutes, intensity, weight_kg, kcal')
    .eq('user_id', userId)
    .gte('logged_on', keys[0])
    .lte('logged_on', keys[6])
    .order('logged_on', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as GymSessionRow[]).map(mapRow);
}

export async function fetchGymSessionForDate(
  userId: string,
  loggedOn: string,
): Promise<GymSession | null> {
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('id, user_id, logged_on, duration_minutes, intensity, weight_kg, kcal')
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .maybeSingle<GymSessionRow>();

  if (error) {
    throw error;
  }

  return data ? mapRow(data) : null;
}

export async function upsertGymSession(params: {
  userId: string;
  loggedOn: string;
  durationMinutes: number;
  intensity: GymIntensity;
  weightKg: number;
}): Promise<GymSession> {
  const kcal = calculateGymCalories({
    weightKg: params.weightKg,
    durationMinutes: params.durationMinutes,
    intensity: params.intensity,
  });

  const { data, error } = await supabase
    .from('gym_sessions')
    .upsert(
      {
        user_id: params.userId,
        logged_on: params.loggedOn,
        duration_minutes: params.durationMinutes,
        intensity: params.intensity,
        weight_kg: params.weightKg,
        kcal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,logged_on' },
    )
    .select('id, user_id, logged_on, duration_minutes, intensity, weight_kg, kcal')
    .single<GymSessionRow>();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

export async function deleteGymSessionForDate(
  userId: string,
  loggedOn: string,
): Promise<void> {
  const { error } = await supabase
    .from('gym_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('logged_on', loggedOn);

  if (error) {
    throw error;
  }
}

export function weekDotFlags(
  sessions: GymSession[],
  now: Date = new Date(),
): boolean[] {
  const keys = localWeekDateKeys(now);
  const logged = new Set(sessions.map((session) => session.loggedOn));
  return keys.map((key) => logged.has(key));
}

export function weekGymKcalTotal(sessions: GymSession[]): number {
  return sessions.reduce((sum, session) => sum + session.kcal, 0);
}

/** Clamp selectable gym log date to roughly the current local week (Mon–today). */
export function isGymLogDateAllowed(dateKey: string, now: Date = new Date()): boolean {
  const keys = localWeekDateKeys(now);
  const today = localDateKey(now);
  const date = parseDateOnly(dateKey);
  const todayDate = parseDateOnly(today);
  if (date.getTime() > todayDate.getTime()) {
    return false;
  }
  return keys.includes(dateKey);
}
