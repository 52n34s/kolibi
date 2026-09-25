import { createSchemaProbe } from '@/lib/db-schema-errors';
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
  /** App domain name for DB column `training_type`. */
  activity: TrainingActivity;
  durationMinutes: number;
  intensity: TrainingIntensity;
  /** Effective kcal (MET estimate or manual) — DB column `estimated_kcal`. */
  kcal: number;
  kcalSource: TrainingKcalSource;
  /** When it was written — a Kolibi unit's row lands right after the finish. */
  createdAt: string | null;
  /**
   * Written by hand (Trainingslog, Nachtragen without a unit). undefined while
   * the is_manual migration has not run — then the old row rules apply.
   */
  isManual: boolean | undefined;
};

/** Matches public.training_sessions columns. */
type TrainingSessionRow = {
  id: string;
  user_id: string;
  logged_on: string;
  training_type: string;
  duration_min: number;
  intensity: string;
  estimated_kcal: number;
  kcal_source: string | null;
  created_at: string | null;
  /** Only selected once the is_manual migration ran. */
  is_manual?: boolean | null;
};

function isTrainingKcalSource(value: string | null | undefined): value is TrainingKcalSource {
  return value === 'estimated' || value === 'manual';
}

function mapRow(row: TrainingSessionRow): TrainingSession {
  if (!isTrainingActivity(row.training_type)) {
    throw new Error(`Invalid training_type: ${row.training_type}`);
  }
  if (!isTrainingIntensity(row.intensity)) {
    throw new Error(`Invalid training intensity: ${row.intensity}`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    loggedOn: row.logged_on,
    activity: row.training_type,
    durationMinutes: row.duration_min,
    intensity: row.intensity,
    kcal: row.estimated_kcal,
    kcalSource: isTrainingKcalSource(row.kcal_source) ? row.kcal_source : 'estimated',
    createdAt: row.created_at ?? null,
    isManual: row.is_manual == null ? undefined : row.is_manual === true,
  };
}

const TRAINING_SESSION_SELECT =
  'id, user_id, logged_on, training_type, duration_min, intensity, estimated_kcal, kcal_source, created_at';

/** training_sessions.is_manual (20260927102000_training_sessions_is_manual). */
export const hasIsManualColumn = createSchemaProbe(() =>
  supabase.from('training_sessions').select('is_manual').limit(0),
);

/** The row columns, with is_manual once the migration ran. */
async function trainingSessionSelect(): Promise<string> {
  return (await hasIsManualColumn())
    ? `${TRAINING_SESSION_SELECT}, is_manual`
    : TRAINING_SESSION_SELECT;
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

export async function fetchTrainingSessionsForWeek(
  userId: string,
  now: Date = new Date(),
): Promise<TrainingSession[]> {
  const keys = localWeekDateKeys(now);
  const { data, error } = await supabase
    .from('training_sessions')
    .select(await trainingSessionSelect())
    .eq('user_id', userId)
    .gte('logged_on', keys[0])
    .lte('logged_on', keys[6])
    .order('logged_on', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as TrainingSessionRow[]).map(mapRow);
}

export async function fetchTrainingSessionsInRange(
  userId: string,
  startKey: string,
  endKey: string,
): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(await trainingSessionSelect())
    .eq('user_id', userId)
    .gte('logged_on', startKey)
    .lte('logged_on', endKey)
    .order('logged_on', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as TrainingSessionRow[]).map(mapRow);
}

export async function fetchTrainingSessionsForDate(
  userId: string,
  loggedOn: string,
): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(await trainingSessionSelect())
    .eq('user_id', userId)
    .eq('logged_on', loggedOn)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as TrainingSessionRow[]).map(mapRow);
}

export async function insertTrainingSession(params: {
  userId: string;
  loggedOn: string;
  activity: TrainingActivity;
  durationMinutes: number;
  intensity: TrainingIntensity;
  /** Used only for MET estimate — not stored (no weight_kg column). */
  weightKg: number;
  /** When set and > 0, stored as manual kcal; otherwise MET estimate. */
  manualKcal?: number | null;
  /** True for entries written by hand; a Kolibi unit's own row leaves it false. */
  isManual?: boolean;
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

  // Without the migration the column is left out entirely — PostgREST would
  // otherwise reject the whole row (PGRST204).
  const select = await trainingSessionSelect();
  const isManual = params.isManual === true && (await hasIsManualColumn());

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      user_id: params.userId,
      logged_on: params.loggedOn,
      training_type: params.activity,
      duration_min: params.durationMinutes,
      intensity: params.intensity,
      estimated_kcal: kcal,
      kcal_source: kcalSource,
      ...(isManual ? { is_manual: true } : {}),
    })
    .select(select)
    .single<TrainingSessionRow>();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

/**
 * Update linked training_sessions row and recalculate MET kcal when duration/intensity change.
 * Manual kcal_source stays manual only when caller passes manualKcal; otherwise re-estimate.
 */
export async function updateTrainingSession(params: {
  id: string;
  userId: string;
  loggedOn: string;
  durationMinutes: number;
  intensity: TrainingIntensity;
  weightKg: number;
  /** Preserve prior manual kcal when provided; otherwise MET estimate. */
  manualKcal?: number | null;
}): Promise<TrainingSession> {
  const estimatedKcal = calculateTrainingCalories({
    activity: 'strength',
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
    .update({
      logged_on: params.loggedOn,
      duration_min: params.durationMinutes,
      intensity: params.intensity,
      estimated_kcal: kcal,
      kcal_source: kcalSource,
    })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .select(await trainingSessionSelect())
    .single<TrainingSessionRow>();

  if (error) {
    throw error;
  }

  return mapRow(data);
}

export async function deleteTrainingSessionById(
  userId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

/** True for each Mon–Sun day that has ≥1 session (multiple same-day rows → one filled dot). */
export function weekDotFlags(
  sessions: TrainingSession[],
  now: Date = new Date(),
): boolean[] {
  const keys = localWeekDateKeys(now);
  const logged = new Set(sessions.map((session) => session.loggedOn));
  return keys.map((key) => logged.has(key));
}

/** Distinct calendar days with ≥1 session — weekly goal progress (not row count). */
export function countDistinctTrainingDays(sessions: TrainingSession[]): number {
  return new Set(sessions.map((session) => session.loggedOn)).size;
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
