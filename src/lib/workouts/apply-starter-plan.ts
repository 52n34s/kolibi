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
import { saveTemplate } from '@/lib/workouts/workouts-api';
import type { ExerciseKind } from '@/lib/workouts/types';
import { isExerciseKind } from '@/lib/workouts/types';

type CatalogRow = {
  id: string;
  catalog_slug: string | null;
  kind: string;
};

function captureAndThrow(error: unknown): never {
  Sentry.captureException(error);
  throw error;
}

/**
 * One catalog lookup for all slugs in the plan. Missing slugs → abort before
 * any template is written.
 */
async function fetchCatalogBySlugs(
  slugs: readonly string[],
): Promise<Map<string, { id: string; kind: ExerciseKind }>> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, catalog_slug, kind')
    .is('user_id', null)
    .in('catalog_slug', [...slugs]);

  if (error) {
    captureAndThrow(error);
  }

  const bySlug = new Map<string, { id: string; kind: ExerciseKind }>();
  for (const row of (data ?? []) as CatalogRow[]) {
    if (row.catalog_slug == null || !isExerciseKind(row.kind)) {
      continue;
    }
    bySlug.set(row.catalog_slug, { id: row.id, kind: row.kind });
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
 * Missing catalog slugs abort with nothing created. A failure while saving a
 * later session leaves already-created templates and reports via captureAndThrow.
 */
export async function applyStarterPlan(
  planId: StarterPlanId,
  params: { userId: string; queryClient: QueryClient },
): Promise<void> {
  const plan = getStarterPlan(planId);
  const slugs = collectStarterPlanSlugs(plan);

  let catalog: Map<string, { id: string; kind: ExerciseKind }>;
  try {
    catalog = await fetchCatalogBySlugs(slugs);
  } catch (error) {
    captureAndThrow(error);
  }

  const missing = slugs.filter((slug) => !catalog.has(slug));
  if (missing.length > 0) {
    captureAndThrow(new StarterPlanMissingSlugsError(missing));
  }

  try {
    for (let index = 0; index < plan.sessions.length; index += 1) {
      const session = plan.sessions[index]!;
      await saveTemplate({
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
    captureAndThrow(error);
  }
}
