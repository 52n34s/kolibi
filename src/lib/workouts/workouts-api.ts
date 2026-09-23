import * as Sentry from '@sentry/react-native';

import { newId } from '@/lib/id';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { sessionSetsToHistoryUnits } from '@/lib/workouts/progression-history';
import type { ProgressionHistoryUnit } from '@/lib/workouts/progression';
import { uploadImageToStorage } from '@/lib/storage-upload';
import { supabase } from '@/lib/supabase';
import {
  isExerciseKind,
  isGymIntensity,
  isProgressionEventKind,
  isProgressionEventStatus,
  isProgressionKind,
  isUnitColorKey,
  type Exercise,
  type ExerciseKind,
  type GymIntensity,
  type ProgressionEvent,
  type ProgressionEventKind,
  type ProgressionEventStatus,
  type ProgressionTarget,
  type SessionSet,
  type TemplateExercise,
  type UnitColorKey,
  type WorkoutSession,
  type WorkoutTemplate,
} from '@/lib/workouts/types';

const EXERCISE_IMAGE_BUCKET = 'exercise-images';
const EXERCISE_IMAGE_MAX_EDGE_PX = 800;
const EXERCISE_IMAGE_QUALITY = 0.8;

type ExerciseRow = {
  id: string;
  user_id: string | null;
  catalog_slug: string | null;
  names: Record<string, string> | null;
  kind: string;
  per_side: boolean;
  default_sets: number;
  default_reps: number | null;
  default_reps_max: number | null;
  default_seconds: number | null;
  default_seconds_max: number | null;
  default_rest_seconds: number | null;
  image_asset: string | null;
  image_path: string | null;
  note: string | null;
  archived_at: string | null;
  ladder_key: string | null;
  ladder_step: number | null;
  progression_kind: string;
  time_cap_seconds: number | null;
};

type TemplateRow = {
  id: string;
  name: string;
  short_label: string;
  color_key: string;
  weekdays: number[] | null;
  position: number;
  archived_at: string | null;
};

type TemplateExerciseRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number | null;
  target_reps_max: number | null;
  target_seconds: number | null;
  target_seconds_max: number | null;
  target_weight_kg: number | string | null;
  rest_seconds: number | null;
  exercises: ExerciseRow | ExerciseRow[] | null;
};

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_name: string;
  short_label: string;
  color_key: string;
  logged_on: string;
  started_at: string;
  finished_at: string | null;
  intensity: string | null;
  training_session_id: string | null;
  created_at: string;
};

type SessionSetRow = {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string | null;
  exercise_name: string;
  exercise_position: number;
  set_index: number;
  kind: string;
  per_side: boolean;
  target_reps: number | null;
  target_reps_max: number | null;
  target_seconds: number | null;
  target_seconds_max: number | null;
  target_weight_kg: number | string | null;
  reps: number | null;
  seconds: number | null;
  seconds_other_side: number | null;
  weight_kg: number | string | null;
  completed_at: string;
};

function captureAndThrow(error: unknown): never {
  Sentry.captureException(error);
  throw error;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    captureAndThrow(error);
  }
  const userId = data.user?.id;
  if (!userId) {
    captureAndThrow(new Error('not_authenticated'));
  }
  return userId;
}

function mapExercise(row: ExerciseRow): Exercise {
  if (!isExerciseKind(row.kind)) {
    throw new Error(`Invalid exercise kind: ${row.kind}`);
  }
  const progressionKind = isProgressionKind(row.progression_kind)
    ? row.progression_kind
    : 'variant';
  return {
    id: row.id,
    userId: row.user_id,
    catalogSlug: row.catalog_slug,
    names: (row.names ?? {}) as Record<string, string>,
    kind: row.kind,
    perSide: row.per_side,
    defaultSets: row.default_sets,
    defaultReps: row.default_reps,
    defaultRepsMax: row.default_reps_max,
    defaultSeconds: row.default_seconds,
    defaultSecondsMax: row.default_seconds_max,
    defaultRestSeconds: row.default_rest_seconds,
    imageAsset: row.image_asset,
    imagePath: row.image_path,
    note: row.note,
    archivedAt: row.archived_at,
    ladderKey: row.ladder_key,
    ladderStep: row.ladder_step,
    progressionKind,
    timeCapSeconds: row.time_cap_seconds,
  };
}

function nestExercise(value: ExerciseRow | ExerciseRow[] | null): ExerciseRow | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSessionSet(row: SessionSetRow): SessionSet {
  if (!isExerciseKind(row.kind)) {
    throw new Error(`Invalid session set kind: ${row.kind}`);
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    exercisePosition: row.exercise_position,
    setIndex: row.set_index,
    kind: row.kind,
    perSide: row.per_side,
    targetReps: row.target_reps,
    targetRepsMax: row.target_reps_max,
    targetSeconds: row.target_seconds,
    targetSecondsMax: row.target_seconds_max,
    targetWeightKg:
      row.target_weight_kg == null ? null : Number(row.target_weight_kg),
    reps: row.reps,
    seconds: row.seconds,
    secondsOtherSide: row.seconds_other_side,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    completedAt: row.completed_at,
  };
}

function mapWorkoutSession(row: WorkoutSessionRow, sets: SessionSet[] = []): WorkoutSession {
  const colorKey = isUnitColorKey(row.color_key) ? row.color_key : 'indigo';
  const intensity =
    row.intensity != null && isGymIntensity(row.intensity) ? row.intensity : null;
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    templateName: row.template_name,
    shortLabel: row.short_label,
    colorKey,
    loggedOn: row.logged_on,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    intensity,
    trainingSessionId: row.training_session_id,
    createdAt: row.created_at,
    sets,
  };
}

const EXERCISE_SELECT =
  'id, user_id, catalog_slug, names, kind, per_side, default_sets, default_reps, default_reps_max, default_seconds, default_seconds_max, default_rest_seconds, image_asset, image_path, note, archived_at, ladder_key, ladder_step, progression_kind, time_cap_seconds';

export async function fetchExercises(): Promise<Exercise[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .is('archived_at', null)
      .or(`user_id.is.null,user_id.eq.${userId}`);

    if (error) {
      throw error;
    }

    const mapped = ((data ?? []) as ExerciseRow[]).map(mapExercise);
    mapped.sort((a, b) => {
      const aOwn = a.userId != null ? 0 : 1;
      const bOwn = b.userId != null ? 0 : 1;
      if (aOwn !== bOwn) {
        return aOwn - bOwn;
      }
      return resolveExerciseName(a, 'de').localeCompare(resolveExerciseName(b, 'de'), 'de');
    });
    return mapped;
  } catch (error) {
    captureAndThrow(error);
  }
}

export type CreateExerciseInput = {
  id?: string;
  names: Record<string, string>;
  kind: ExerciseKind;
  perSide?: boolean;
  defaultSets: number;
  defaultReps?: number | null;
  defaultSeconds?: number | null;
  defaultRestSeconds?: number | null;
  imageAsset?: string | null;
  note?: string | null;
};

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  try {
    const userId = await requireUserId();
    const id = input.id ?? newId();
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        id,
        user_id: userId,
        catalog_slug: null,
        names: input.names,
        kind: input.kind,
        per_side: input.perSide ?? false,
        default_sets: input.defaultSets,
        default_reps: input.defaultReps ?? null,
        default_seconds: input.defaultSeconds ?? null,
        default_rest_seconds: input.defaultRestSeconds ?? null,
        image_asset: input.imageAsset ?? null,
        note: input.note ?? null,
      })
      .select(EXERCISE_SELECT)
      .single();

    if (error) {
      throw error;
    }
    return mapExercise(data as ExerciseRow);
  } catch (error) {
    captureAndThrow(error);
  }
}

export type UpdateExerciseInput = {
  names?: Record<string, string>;
  kind?: ExerciseKind;
  perSide?: boolean;
  defaultSets?: number;
  defaultReps?: number | null;
  defaultSeconds?: number | null;
  defaultRestSeconds?: number | null;
  imagePath?: string | null;
  imageAsset?: string | null;
  note?: string | null;
};

export async function updateExercise(
  exerciseId: string,
  input: UpdateExerciseInput,
): Promise<Exercise> {
  try {
    const userId = await requireUserId();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.names != null) patch.names = input.names;
    if (input.kind != null) patch.kind = input.kind;
    if (input.perSide != null) patch.per_side = input.perSide;
    if (input.defaultSets != null) patch.default_sets = input.defaultSets;
    if (input.defaultReps !== undefined) patch.default_reps = input.defaultReps;
    if (input.defaultSeconds !== undefined) patch.default_seconds = input.defaultSeconds;
    if (input.defaultRestSeconds !== undefined) {
      patch.default_rest_seconds = input.defaultRestSeconds;
    }
    if (input.imagePath !== undefined) patch.image_path = input.imagePath;
    if (input.imageAsset !== undefined) patch.image_asset = input.imageAsset;
    if (input.note !== undefined) patch.note = input.note;

    const { data, error } = await supabase
      .from('exercises')
      .update(patch)
      .eq('id', exerciseId)
      .eq('user_id', userId)
      .select(EXERCISE_SELECT)
      .single();

    if (error) {
      throw error;
    }
    return mapExercise(data as ExerciseRow);
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function archiveExercise(exerciseId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('exercises')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', exerciseId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function uploadExerciseImage(params: {
  exerciseId: string;
  localUri: string;
}): Promise<string> {
  try {
    const userId = await requireUserId();
    const { objectPath } = await uploadImageToStorage({
      bucket: EXERCISE_IMAGE_BUCKET,
      objectPath: `${userId}/${params.exerciseId}.webp`,
      localUri: params.localUri,
      format: 'webp',
      maxEdgePx: EXERCISE_IMAGE_MAX_EDGE_PX,
      quality: EXERCISE_IMAGE_QUALITY,
    });

    await updateExercise(params.exerciseId, { imagePath: objectPath });
    return objectPath;
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function getExerciseImageSignedUrl(
  imagePath: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  try {
    if (!imagePath) {
      return null;
    }
    const { data, error } = await supabase.storage
      .from(EXERCISE_IMAGE_BUCKET)
      .createSignedUrl(imagePath, expiresInSeconds);

    if (error) {
      throw error;
    }
    return data.signedUrl;
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const userId = await requireUserId();
    const { data: templates, error } = await supabase
      .from('workout_templates')
      .select('id, name, short_label, color_key, weekdays, position, archived_at')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    const templateRows = (templates ?? []) as TemplateRow[];
    if (templateRows.length === 0) {
      return [];
    }

    const templateIds = templateRows.map((row) => row.id);
    const { data: teRows, error: teError } = await supabase
      .from('template_exercises')
      .select(
        `id, template_id, exercise_id, position, target_sets, target_reps, target_reps_max,
         target_seconds, target_seconds_max, target_weight_kg, rest_seconds,
         exercises (${EXERCISE_SELECT})`,
      )
      .in('template_id', templateIds)
      .order('position', { ascending: true });

    if (teError) {
      throw teError;
    }

    const byTemplate = new Map<string, TemplateExercise[]>();
    for (const raw of (teRows ?? []) as TemplateExerciseRow[]) {
      const exerciseRow = nestExercise(raw.exercises);
      if (!exerciseRow) {
        continue;
      }
      const exercise = mapExercise(exerciseRow);
      const item: TemplateExercise = {
        id: raw.id,
        exerciseId: raw.exercise_id,
        exercise,
        position: raw.position,
        targetSets: raw.target_sets,
        targetReps: raw.target_reps,
        targetRepsMax: raw.target_reps_max,
        targetSeconds: raw.target_seconds,
        targetSecondsMax: raw.target_seconds_max,
        targetWeightKg:
          raw.target_weight_kg == null ? null : Number(raw.target_weight_kg),
        restSeconds: raw.rest_seconds,
      };
      const list = byTemplate.get(raw.template_id) ?? [];
      list.push(item);
      byTemplate.set(raw.template_id, list);
    }

    return templateRows.map((row) => {
      const colorKey: UnitColorKey = isUnitColorKey(row.color_key) ? row.color_key : 'indigo';
      return {
        id: row.id,
        name: row.name,
        shortLabel: row.short_label,
        colorKey,
        weekdays: row.weekdays ?? [],
        position: row.position,
        exercises: byTemplate.get(row.id) ?? [],
      };
    });
  } catch (error) {
    captureAndThrow(error);
  }
}

export type SaveTemplateExerciseInput = {
  exerciseId: string;
  targetSets: number;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetSeconds?: number | null;
  targetSecondsMax?: number | null;
  targetWeightKg?: number | null;
  restSeconds?: number | null;
};

export type SaveTemplateInput = {
  id?: string | null;
  name: string;
  shortLabel: string;
  colorKey?: UnitColorKey;
  weekdays: number[];
  position?: number;
  exercises: SaveTemplateExerciseInput[];
};

export async function saveTemplate(input: SaveTemplateInput): Promise<string> {
  try {
    await requireUserId();
    const pTemplate = {
      id: input.id ?? null,
      name: input.name,
      short_label: input.shortLabel,
      color_key: input.colorKey ?? 'indigo',
      weekdays: input.weekdays,
      position: input.position ?? 0,
    };
    const pExercises = input.exercises.map((exercise) => ({
      exercise_id: exercise.exerciseId,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps ?? '',
      target_reps_max: exercise.targetRepsMax ?? '',
      target_seconds: exercise.targetSeconds ?? '',
      target_seconds_max: exercise.targetSecondsMax ?? '',
      target_weight_kg: exercise.targetWeightKg ?? '',
      rest_seconds: exercise.restSeconds ?? '',
    }));

    const { data, error } = await supabase.rpc('save_workout_template', {
      p_template: pTemplate,
      p_exercises: pExercises,
    });

    if (error) {
      throw error;
    }
    return data as string;
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function archiveTemplate(templateId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('workout_templates')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    captureAndThrow(error);
  }
}

/** Hard-delete templates (and cascaded template_exercises). Used for starter-plan rollback. */
export async function deleteWorkoutTemplatesByIds(templateIds: string[]): Promise<void> {
  if (templateIds.length === 0) {
    return;
  }
  try {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('user_id', userId)
      .in('id', templateIds);

    if (error) {
      throw error;
    }
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function reorderTemplates(orderedIds: string[]): Promise<void> {
  try {
    const userId = await requireUserId();
    await Promise.all(
      orderedIds.map(async (id, index) => {
        const { error } = await supabase
          .from('workout_templates')
          .update({ position: index, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          throw error;
        }
      }),
    );
  } catch (error) {
    captureAndThrow(error);
  }
}

export type UpsertWorkoutSessionInput = {
  id: string;
  /** Owner of the session — written as-is, never auth.uid(). */
  userId: string;
  templateId?: string | null;
  templateName: string;
  shortLabel: string;
  colorKey: UnitColorKey;
  loggedOn: string;
  startedAt: string;
  finishedAt?: string | null;
  intensity?: GymIntensity | null;
  trainingSessionId?: string | null;
};

export async function upsertWorkoutSession(
  input: UpsertWorkoutSessionInput,
): Promise<WorkoutSession> {
  try {
    // user_id comes from the operation, not from auth.uid(): a queued write
    // belongs to whoever started the session.
    const { data, error } = await supabase
      .from('workout_sessions')
      .upsert(
        {
          id: input.id,
          user_id: input.userId,
          template_id: input.templateId ?? null,
          template_name: input.templateName,
          short_label: input.shortLabel,
          color_key: input.colorKey,
          logged_on: input.loggedOn,
          started_at: input.startedAt,
          finished_at: input.finishedAt ?? null,
          intensity: input.intensity ?? null,
          training_session_id: input.trainingSessionId ?? null,
        },
        { onConflict: 'id' },
      )
      .select(
        'id, user_id, template_id, template_name, short_label, color_key, logged_on, started_at, finished_at, intensity, training_session_id, created_at',
      )
      .single();

    if (error) {
      throw error;
    }
    return mapWorkoutSession(data as WorkoutSessionRow);
  } catch (error) {
    captureAndThrow(error);
  }
}

export type UpsertSessionSetInput = {
  id: string;
  sessionId: string;
  /** Owner of the session this set belongs to. */
  userId: string;
  exerciseId?: string | null;
  exerciseName: string;
  exercisePosition: number;
  setIndex: number;
  kind: ExerciseKind;
  perSide?: boolean;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetSeconds?: number | null;
  targetSecondsMax?: number | null;
  targetWeightKg?: number | null;
  reps?: number | null;
  seconds?: number | null;
  secondsOtherSide?: number | null;
  weightKg?: number | null;
  completedAt?: string;
};

export async function upsertSessionSets(
  sets: UpsertSessionSetInput[],
): Promise<SessionSet[]> {
  try {
    if (sets.length === 0) {
      return [];
    }
    const rows = sets.map((set) => ({
      id: set.id,
      session_id: set.sessionId,
      user_id: set.userId,
      exercise_id: set.exerciseId ?? null,
      exercise_name: set.exerciseName,
      exercise_position: set.exercisePosition,
      set_index: set.setIndex,
      kind: set.kind,
      per_side: set.perSide ?? false,
      target_reps: set.targetReps ?? null,
      target_reps_max: set.targetRepsMax ?? null,
      target_seconds: set.targetSeconds ?? null,
      target_seconds_max: set.targetSecondsMax ?? null,
      target_weight_kg: set.targetWeightKg ?? null,
      reps: set.reps ?? null,
      seconds: set.seconds ?? null,
      seconds_other_side: set.secondsOtherSide ?? null,
      weight_kg: set.weightKg ?? null,
      completed_at: set.completedAt ?? new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('session_sets')
      .upsert(rows, { onConflict: 'id' })
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      );

    if (error) {
      throw error;
    }
    return ((data ?? []) as SessionSetRow[]).map(mapSessionSet);
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    const { data: session, error: fetchError } = await supabase
      .from('workout_sessions')
      .select('id, training_session_id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const trainingSessionId = session?.training_session_id ?? null;

    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    if (trainingSessionId) {
      const { error: tsError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', trainingSessionId)
        .eq('user_id', userId);
      if (tsError) {
        throw tsError;
      }
    }
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchWorkoutSessionsInRange(
  startKey: string,
  endKey: string,
): Promise<WorkoutSession[]> {
  try {
    const userId = await requireUserId();
    const { data: sessions, error } = await supabase
      .from('workout_sessions')
      .select(
        'id, user_id, template_id, template_name, short_label, color_key, logged_on, started_at, finished_at, intensity, training_session_id, created_at',
      )
      .eq('user_id', userId)
      .gte('logged_on', startKey)
      .lte('logged_on', endKey)
      .order('logged_on', { ascending: false })
      .order('started_at', { ascending: false });

    if (error) {
      throw error;
    }

    const sessionRows = (sessions ?? []) as WorkoutSessionRow[];
    if (sessionRows.length === 0) {
      return [];
    }

    const ids = sessionRows.map((row) => row.id);
    const { data: setRows, error: setError } = await supabase
      .from('session_sets')
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      )
      .in('session_id', ids)
      .order('exercise_position', { ascending: true })
      .order('set_index', { ascending: true });

    if (setError) {
      throw setError;
    }

    const setsBySession = new Map<string, SessionSet[]>();
    for (const row of (setRows ?? []) as SessionSetRow[]) {
      const mapped = mapSessionSet(row);
      const list = setsBySession.get(mapped.sessionId) ?? [];
      list.push(mapped);
      setsBySession.set(mapped.sessionId, list);
    }

    return sessionRows.map((row) =>
      mapWorkoutSession(row, setsBySession.get(row.id) ?? []),
    );
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchWorkoutSessionById(
  sessionId: string,
): Promise<WorkoutSession | null> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        'id, user_id, template_id, template_name, short_label, color_key, logged_on, started_at, finished_at, intensity, training_session_id, created_at',
      )
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    const { data: setRows, error: setError } = await supabase
      .from('session_sets')
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      )
      .eq('session_id', sessionId)
      .order('exercise_position', { ascending: true })
      .order('set_index', { ascending: true });

    if (setError) {
      throw setError;
    }

    return mapWorkoutSession(
      data as WorkoutSessionRow,
      ((setRows ?? []) as SessionSetRow[]).map(mapSessionSet),
    );
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchExerciseById(exerciseId: string): Promise<Exercise | null> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .eq('id', exerciseId)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    return mapExercise(data as ExerciseRow);
  } catch (error) {
    captureAndThrow(error);
  }
}

/**
 * Sessions that include `exerciseId`, newest first. Optional `startKey` (inclusive).
 */
export async function fetchSessionsContainingExercise(
  exerciseId: string,
  startKey: string | null = null,
): Promise<WorkoutSession[]> {
  try {
    const userId = await requireUserId();
    const { data: setRows, error: setError } = await supabase
      .from('session_sets')
      .select('session_id')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId);

    if (setError) {
      throw setError;
    }

    const sessionIds = [
      ...new Set(((setRows ?? []) as { session_id: string }[]).map((row) => row.session_id)),
    ];
    if (sessionIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('workout_sessions')
      .select(
        'id, user_id, template_id, template_name, short_label, color_key, logged_on, started_at, finished_at, intensity, training_session_id, created_at',
      )
      .eq('user_id', userId)
      .in('id', sessionIds)
      .order('logged_on', { ascending: false })
      .order('started_at', { ascending: false });

    if (startKey != null) {
      query = query.gte('logged_on', startKey);
    }

    const { data: sessions, error } = await query;
    if (error) {
      throw error;
    }

    const sessionRows = (sessions ?? []) as WorkoutSessionRow[];
    if (sessionRows.length === 0) {
      return [];
    }

    const ids = sessionRows.map((row) => row.id);
    const { data: allSets, error: allSetsError } = await supabase
      .from('session_sets')
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      )
      .in('session_id', ids)
      .eq('exercise_id', exerciseId)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      throw allSetsError;
    }

    const setsBySession = new Map<string, SessionSet[]>();
    for (const row of (allSets ?? []) as SessionSetRow[]) {
      const mapped = mapSessionSet(row);
      const list = setsBySession.get(mapped.sessionId) ?? [];
      list.push(mapped);
      setsBySession.set(mapped.sessionId, list);
    }

    return sessionRows.map((row) =>
      mapWorkoutSession(row, setsBySession.get(row.id) ?? []),
    );
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchExerciseHistory(
  exerciseId: string,
  limit = 40,
): Promise<SessionSet[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('session_sets')
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      )
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }
    return ((data ?? []) as SessionSetRow[]).map(mapSessionSet);
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchExerciseHistoryUnits(
  exerciseId: string,
  limitSessions = 20,
): Promise<ProgressionHistoryUnit[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('session_sets')
      .select(
        `id, session_id, user_id, exercise_id, exercise_name, exercise_position, set_index, kind,
         per_side, target_reps, target_reps_max, target_seconds, target_seconds_max, target_weight_kg,
         reps, seconds, seconds_other_side, weight_kg, completed_at`,
      )
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('completed_at', { ascending: false })
      .limit(limitSessions * 12);

    if (error) {
      throw error;
    }

    const sets = ((data ?? []) as SessionSetRow[]).map(mapSessionSet);
    const sessionIds: string[] = [];
    const seen = new Set<string>();
    for (const set of sets) {
      if (!seen.has(set.sessionId)) {
        seen.add(set.sessionId);
        sessionIds.push(set.sessionId);
      }
      if (sessionIds.length >= limitSessions) {
        break;
      }
    }

    const intensityBySessionId: Record<string, GymIntensity | null> = {};
    if (sessionIds.length > 0) {
      const { data: sessions, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('id, intensity')
        .eq('user_id', userId)
        .in('id', sessionIds);
      if (sessionError) {
        throw sessionError;
      }
      for (const row of (sessions ?? []) as { id: string; intensity: string | null }[]) {
        intensityBySessionId[row.id] =
          row.intensity != null && isGymIntensity(row.intensity) ? row.intensity : null;
      }
    }

    const units = sessionSetsToHistoryUnits(sets, intensityBySessionId);
    return units.filter((unit) => sessionIds.includes(unit.sessionId)).slice(0, limitSessions);
  } catch (error) {
    captureAndThrow(error);
  }
}

/**
 * Max single-set performance per exercise_id for sets logged before `beforeDateKey`
 * (exclusive). Slim columns only; aggregated client-side (no full SessionSet rows).
 */
export async function fetchExerciseBestsBefore(
  beforeDateKey: string,
): Promise<Record<string, number>> {
  try {
    const userId = await requireUserId();
    const { data: sessions, error: sessionError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .lt('logged_on', beforeDateKey);

    if (sessionError) {
      throw sessionError;
    }
    const sessionIds = ((sessions ?? []) as { id: string }[]).map((row) => row.id);
    if (sessionIds.length === 0) {
      return {};
    }

    type SlimRow = {
      exercise_id: string | null;
      kind: string;
      per_side: boolean | null;
      reps: number | null;
      seconds: number | null;
      seconds_other_side: number | null;
    };

    const bests: Record<string, number> = {};
    const chunkSize = 100;
    for (let offset = 0; offset < sessionIds.length; offset += chunkSize) {
      const chunk = sessionIds.slice(offset, offset + chunkSize);
      const { data, error } = await supabase
        .from('session_sets')
        .select('exercise_id, kind, per_side, reps, seconds, seconds_other_side')
        .eq('user_id', userId)
        .in('session_id', chunk);

      if (error) {
        throw error;
      }

      for (const row of (data ?? []) as SlimRow[]) {
        if (row.exercise_id == null) {
          continue;
        }
        let value: number | null = null;
        if (row.kind === 'time') {
          if (row.seconds == null || !Number.isFinite(Number(row.seconds))) {
            continue;
          }
          const seconds = Number(row.seconds);
          if (
            row.per_side &&
            row.seconds_other_side != null &&
            Number.isFinite(Number(row.seconds_other_side))
          ) {
            value = Math.min(seconds, Number(row.seconds_other_side));
          } else {
            value = seconds;
          }
        } else if (row.reps != null && Number.isFinite(Number(row.reps))) {
          value = Number(row.reps);
        }
        if (value == null) {
          continue;
        }
        const prev = bests[row.exercise_id];
        if (prev == null || value > prev) {
          bests[row.exercise_id] = value;
        }
      }
    }

    return bests;
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function deleteSessionSet(setId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('session_sets')
      .delete()
      .eq('id', setId)
      .eq('user_id', userId);
    if (error) {
      throw error;
    }
  } catch (error) {
    captureAndThrow(error);
  }
}

type ProgressionEventRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  session_id: string | null;
  kind: string;
  from_exercise_id: string | null;
  to_exercise_id: string | null;
  from_target: ProgressionTarget | null;
  to_target: ProgressionTarget | null;
  status: string;
  created_at: string;
};

function mapProgressionTarget(value: unknown): ProgressionTarget {
  const raw = (value ?? {}) as Partial<ProgressionTarget>;
  return {
    targetSets: typeof raw.targetSets === 'number' ? raw.targetSets : 0,
    targetReps: raw.targetReps ?? null,
    targetRepsMax: raw.targetRepsMax ?? null,
    targetSeconds: raw.targetSeconds ?? null,
    targetSecondsMax: raw.targetSecondsMax ?? null,
  };
}

function mapProgressionEvent(row: ProgressionEventRow): ProgressionEvent {
  if (!isProgressionEventKind(row.kind)) {
    throw new Error(`Invalid progression event kind: ${row.kind}`);
  }
  if (!isProgressionEventStatus(row.status)) {
    throw new Error(`Invalid progression event status: ${row.status}`);
  }
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    sessionId: row.session_id,
    kind: row.kind,
    fromExerciseId: row.from_exercise_id,
    toExerciseId: row.to_exercise_id,
    fromTarget: mapProgressionTarget(row.from_target),
    toTarget: mapProgressionTarget(row.to_target),
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Catalog ladder rungs for a key, sorted by ladder_step ascending. */
/**
 * Exercises by id — catalog and own, archived included.
 *
 * Needed wherever an id can point outside the current plan: after a
 * `variant_up` the replaced exercise is gone from the template, and the
 * export would otherwise have nothing but the raw UUID to print.
 */
export async function fetchExercisesByIds(ids: readonly string[]): Promise<Exercise[]> {
  try {
    const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
    if (unique.length === 0) {
      return [];
    }
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .in('id', unique)
      .or(`user_id.is.null,user_id.eq.${userId}`);

    if (error) {
      throw error;
    }
    return ((data ?? []) as ExerciseRow[]).map(mapExercise);
  } catch (error) {
    captureAndThrow(error);
  }
}

export async function fetchLadder(ladderKey: string): Promise<Exercise[]> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select(EXERCISE_SELECT)
      .eq('ladder_key', ladderKey)
      .is('user_id', null)
      .is('archived_at', null)
      .order('ladder_step', { ascending: true });

    if (error) {
      throw error;
    }
    return ((data ?? []) as ExerciseRow[]).map(mapExercise);
  } catch (error) {
    captureAndThrow(error);
  }
}

export type InsertProgressionEventInput = {
  templateId?: string | null;
  sessionId?: string | null;
  kind: ProgressionEventKind;
  fromExerciseId?: string | null;
  toExerciseId?: string | null;
  fromTarget: ProgressionTarget;
  toTarget: ProgressionTarget;
  status: ProgressionEventStatus;
};

export async function insertProgressionEvent(
  input: InsertProgressionEventInput,
): Promise<ProgressionEvent> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('progression_events')
      .insert({
        user_id: userId,
        template_id: input.templateId ?? null,
        session_id: input.sessionId ?? null,
        kind: input.kind,
        from_exercise_id: input.fromExerciseId ?? null,
        to_exercise_id: input.toExerciseId ?? null,
        from_target: input.fromTarget,
        to_target: input.toTarget,
        status: input.status,
      })
      .select(
        'id, user_id, template_id, session_id, kind, from_exercise_id, to_exercise_id, from_target, to_target, status, created_at',
      )
      .single();

    if (error) {
      throw error;
    }
    return mapProgressionEvent(data as ProgressionEventRow);
  } catch (error) {
    captureAndThrow(error);
  }
}

export type FetchProgressionEventsParams = {
  templateId?: string;
  exerciseId?: string;
  since?: string;
};

export async function fetchProgressionEvents(
  params: FetchProgressionEventsParams = {},
): Promise<ProgressionEvent[]> {
  try {
    const userId = await requireUserId();
    let query = supabase
      .from('progression_events')
      .select(
        'id, user_id, template_id, session_id, kind, from_exercise_id, to_exercise_id, from_target, to_target, status, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (params.templateId != null) {
      query = query.eq('template_id', params.templateId);
    }
    if (params.exerciseId != null) {
      query = query.or(
        `from_exercise_id.eq.${params.exerciseId},to_exercise_id.eq.${params.exerciseId}`,
      );
    }
    if (params.since != null) {
      query = query.gte('created_at', params.since);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return ((data ?? []) as ProgressionEventRow[]).map(mapProgressionEvent);
  } catch (error) {
    captureAndThrow(error);
  }
}
