import type { QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

import i18n from '@/i18n';
import { fetchProfileSettings, updateTrainingSessionsPerWeek } from '@/lib/profile';
import { shouldSeedWeeklyGoal } from '@/lib/should-seed-weekly-goal';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import {
  fetchStarterCatalogBySlugs,
  targetsForExercise,
  type StarterCatalogExercise,
} from '@/lib/workouts/apply-starter-plan';
import { collectBuiltPlanSlugs, type BuiltPlan } from '@/lib/workouts/plan-builder';
import { StarterPlanMissingSlugsError } from '@/lib/workouts/starter-plans';
import {
  archiveTemplate,
  deleteWorkoutTemplatesByIds,
  fetchTemplates,
  reorderTemplates,
  restoreTemplate,
  saveTemplate,
} from '@/lib/workouts/workouts-api';

/** add: after the active units. replace: active units go to the archive. */
export type ApplyBuiltPlanMode = 'add' | 'replace';

function captureAndThrow(error: unknown): never {
  Sentry.captureException(error);
  throw error;
}

/**
 * Materialise a wizard plan through save_workout_template, like
 * applyStarterPlan. Missing catalog slugs abort with nothing written.
 *
 * replace archives the previous active units (soft, restorable in the plan
 * screen) after the new ones exist; nothing is deleted. On failure the new
 * units are removed again and archived ones restored.
 *
 * Weekly goal: replace sets it to the plan's days; add only seeds it when unset.
 */
export async function applyBuiltPlan(
  plan: BuiltPlan,
  params: { userId: string; queryClient: QueryClient; mode: ApplyBuiltPlanMode },
): Promise<void> {
  const slugs = collectBuiltPlanSlugs(plan);
  if (slugs.length === 0) {
    return;
  }

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

  const active = await fetchTemplates();
  const firstPosition =
    active.reduce((max, template) => Math.max(max, template.position), -1) + 1;

  const createdIds: string[] = [];
  const archivedIds: string[] = [];
  try {
    for (let index = 0; index < plan.sessions.length; index += 1) {
      const session = plan.sessions[index]!;
      if (session.exercises.length === 0) {
        continue;
      }
      const id = await saveTemplate({
        name: i18n.t(session.nameKey),
        shortLabel: i18n.t(session.shortLabelKey).slice(0, 2),
        colorKey: session.color,
        weekdays: [],
        position: firstPosition + index,
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
            restSeconds: exercise.restSeconds,
          };
        }),
      });
      createdIds.push(id);
    }

    if (params.mode === 'replace') {
      for (const template of active) {
        await archiveTemplate(template.id);
        archivedIds.push(template.id);
      }
      await reorderTemplates(createdIds);
    }

    if (plan.sessionsPerWeek != null) {
      const profile = await fetchProfileSettings(params.userId);
      if (params.mode === 'replace' || shouldSeedWeeklyGoal(profile.training_sessions_per_week)) {
        await updateTrainingSessionsPerWeek({
          userId: params.userId,
          sessionsPerWeek: plan.sessionsPerWeek,
        });
      }
    }

    await invalidateTrainingQueries(params.queryClient, params.userId);
  } catch (error) {
    try {
      await deleteWorkoutTemplatesByIds(createdIds);
      for (const id of archivedIds) {
        await restoreTemplate(id);
      }
      await invalidateTrainingQueries(params.queryClient, params.userId);
    } catch (rollbackError) {
      Sentry.captureException(rollbackError);
    }
    captureAndThrow(error);
  }
}
