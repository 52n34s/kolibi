import type { QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

import i18n from '@/i18n';
import { fetchProfileSettings, updateTrainingSessionsPerWeek } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import {
  StarterPlanMissingSlugsError,
  collectStarterPlanSlugs,
  getStarterPlan,
  type StarterPlanExercise,
  type StarterPlanId,
} from '@/lib/workouts/starter-plans';
import {
  deleteWorkoutTemplatesByIds,
  saveTemplate,
} from '@/lib/workouts/workouts-api';
import type { ExerciseKind } from '@/lib/workouts/types';
import { isExerciseKind } from '@/lib/workouts/types';

type CatalogRow = {
  id: string;
  catalog_slug: string | null;
  kind: string;
  names: Record<string, string> | null;
  per_side: boolean;
};

export type StarterCatalogExercise = {
  id: string;
  kind: ExerciseKind;
  names: Record<string, string>;
  perSide: boolean;
};

function captureAndThrow(error: unknown): never {
  Sentry.captureException(error);
  throw error;
}

/**
 * One catalog lookup for all slugs in the plan. Missing slugs → abort before
 * any template is written.
 */
export async function fetchStarterCatalogBySlugs(
  slugs: readonly string[],
): Promise<Map<string, StarterCatalogExercise>> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, catalog_slug, kind, names, per_side')
    .is('user_id', null)
    .in('catalog_slug', [...slugs]);

  if (error) {
    captureAndThrow(error);
  }

  const bySlug = new Map<string, StarterCatalogExercise>();
  for (const row of (data ?? []) as CatalogRow[]) {
    if (row.catalog_slug == null || !isExerciseKind(row.kind)) {
      continue;
    }
    bySlug.set(row.catalog_slug, {
      id: row.id,
      kind: row.kind,
      names: row.names ?? {},
      perSide: row.per_side === true,
    });
  }
  return bySlug;
}

function targetsForExercise(
  kind: ExerciseKind,
  exercise: StarterPlanExercise,
): {
  targetReps: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetSecondsMax: number | null;
} {
  if (kind === 'time') {
    return {
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: exercise.targetMin,
      targetSecondsMax: exercise.targetMax,
    };
  }
  return {
    targetReps: exercise.targetMin,
    targetRepsMax: exercise.targetMax,
    targetSeconds: null,
    targetSecondsMax: null,
  };
}

/**
 * Materialise a starter package as the user's workout_templates (position order),
 * set training_sessions_per_week when still null, then invalidate training queries.
 *
 * Missing catalog slugs abort with nothing created. If a later save fails, already
 * created templates are hard-deleted so the empty-state picker stays reachable.
 */
export async function applyStarterPlan(
  planId: StarterPlanId,
  params: { userId: string; queryClient: QueryClient },
): Promise<void> {
  const plan = getStarterPlan(planId);
  const slugs = collectStarterPlanSlugs(plan);

  let catalog: Map<string, StarterCatalogExercise>;
  try {
    catalog = await fetchStarterCatalogBySlugs(slugs);
  } catch (error) {
    captureAndThrow(error);
  }

  const missing = slugs.filter((slug) => !catalog.has(slug));
  if (missing.length > 0) {
    captureAndThrow(new StarterPlanMissingSlugsError(missing));
  }

  const createdIds: string[] = [];
  try {
    for (let index = 0; index < plan.sessions.length; index += 1) {
      const session = plan.sessions[index]!;
      const id = await saveTemplate({
        name: i18n.t(session.nameKey),
        shortLabel: session.shortLabel,
        colorKey: session.color,
        weekdays: [...session.weekdays],
        position: index,
        exercises: session.exercises.map((exercise) => {
          const catalogExercise = catalog.get(exercise.slug)!;
          const targets = targetsForExercise(catalogExercise.kind, exercise);
          return {
            exerciseId: catalogExercise.id,
            targetSets: exercise.sets,
            targetReps: targets.targetReps,
            targetRepsMax: targets.targetRepsMax,
            targetSeconds: targets.targetSeconds,
            targetSecondsMax: targets.targetSecondsMax,
          };
        }),
      });
      createdIds.push(id);
    }

    const profile = await fetchProfileSettings(params.userId);
    if (profile.training_sessions_per_week == null) {
      await updateTrainingSessionsPerWeek({
        userId: params.userId,
        sessionsPerWeek: plan.sessionsPerWeek,
      });
    }

    await invalidateTrainingQueries(params.queryClient, params.userId);
  } catch (error) {
    if (createdIds.length > 0) {
      try {
        await deleteWorkoutTemplatesByIds(createdIds);
      } catch (rollbackError) {
        Sentry.captureException(rollbackError);
      }
    }
    captureAndThrow(error);
  }
}
