import * as Sentry from '@sentry/react-native';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import {
  isHealthDataAvailable,
  queryWorkoutSamples,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';

import { fetchCalorieGoalForDate } from '@/lib/calorie-goals';
import {
  localDateKey,
  localDayWindow,
  parseDateOnly,
  shiftLocalDateKey,
} from '@/lib/day-window';
import { fetchMealsForLocalDate } from '@/lib/meals';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import {
  displayExerciseName,
  exerciseLabelOrFallback,
  resolveExerciseName,
} from '@/lib/workouts/exercise-name';
import {
  groupSessionSets,
  sessionDurationFromTimestamps,
} from '@/lib/workouts/session-detail-utils';
import { fetchTemplates, fetchWorkoutSessionsInRange, fetchProgressionEvents, fetchLadder, fetchExercisesByIds, fetchExerciseHistoryUnits } from '@/lib/workouts/workouts-api';
import type { Exercise } from '@/lib/workouts/types';
import { suggestProgression } from '@/lib/workouts/progression';
import { fetchProfileSettings } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import {
  fetchTrainingSessionsInRange,
  type TrainingSession,
} from '@/lib/training-sessions';
import { getUserPreference, HEALTH_CONNECTED_PREFERENCE_KEY } from '@/lib/user-preferences';
import { getStoredUnitSystem } from '@/lib/unit-system-storage';
import {
  distanceKmToDisplay,
} from '@/lib/measure-units';
import type { ExportData, ExportDays, ExportNutritionDay, ExportSections } from './types';

function dateKeysInRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const cursor = parseDateOnly(startKey);
  const end = parseDateOnly(endKey);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function exportRangeKeys(days: ExportDays, todayKey = localDateKey()): {
  startKey: string;
  endKey: string;
} {
  return {
    startKey: shiftLocalDateKey(todayKey, -(days - 1)),
    endKey: todayKey,
  };
}

function formatExportDateLabel(dateKey: string, lang: string): string {
  const date = parseDateOnly(dateKey);
  const weekday = date.toLocaleDateString(lang, { weekday: 'short' }).replace(/\.$/, '');
  const day = date.toLocaleDateString(lang, { day: '2-digit', month: '2-digit' });
  return `${weekday} ${day}`;
}

function formatTimeLabel(iso: string, lang: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

function formatItemAmount(item: {
  quantity_grams: number;
  quantity_type: string;
  count: number | null;
  display_unit: 'g' | 'ml';
}): string {
  if (item.quantity_type === 'count' && item.count != null && item.count > 0) {
    return `×${item.count}`;
  }
  const grams = Math.round(item.quantity_grams);
  return `${grams} ${item.display_unit}`;
}

function formatActualSets(
  sets: {
    kind: string;
    perSide: boolean;
    reps: number | null;
    seconds: number | null;
    secondsOtherSide: number | null;
  }[],
  missing: string,
): string {
  return sets
    .map((set) => {
      if (set.kind === 'time') {
        if (set.perSide) {
          const a = set.seconds ?? missing;
          const b = set.secondsOtherSide ?? missing;
          return `${a} / ${b} s`;
        }
        return set.seconds != null ? `${set.seconds} s` : missing;
      }
      return set.reps != null ? String(set.reps) : missing;
    })
    .join(', ');
}

function macroOrNull(kcal: number, value: number): number | null {
  if (kcal > 0 && value === 0) {
    return null;
  }
  if (!(value > 0) && kcal === 0) {
    return null;
  }
  return value;
}

async function fetchRunningKmByDay(
  startKey: string,
  endKey: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return result;
  }
  try {
    const start = parseDateOnly(startKey);
    start.setHours(0, 0, 0, 0);
    const end = parseDateOnly(endKey);
    end.setHours(23, 59, 59, 999);
    const workouts = await queryWorkoutSamples({
      filter: {
        workoutActivityType: WorkoutActivityType.running,
        date: { startDate: start, endDate: end },
      },
      limit: -1,
    });
    for (const workout of workouts) {
      const distance = workout.totalDistance;
      if (distance == null) {
        continue;
      }
      let km = distance.quantity;
      if (distance.unit === 'm') {
        km = km / 1000;
      } else if (distance.unit === 'mi') {
        km = km * 1.60934;
      }
      if (!Number.isFinite(km) || !(km > 0)) {
        continue;
      }
      const key = localDateKey(new Date(workout.startDate));
      result.set(key, Math.round(((result.get(key) ?? 0) + km) * 10) / 10);
    }
  } catch (error) {
    // Expected when Health is not connected — reported at warning level so it
    // stays filterable and does not drown real errors.
    Sentry.captureException(error, { level: 'warning' });
  }
  return result;
}

function resolveGoalLabel(goalType: string | null, t: TFunction): string | null {
  if (goalType == null) {
    return null;
  }
  const key = `onboarding.goal.${goalType}`;
  const label = t(key);
  return label === key ? goalType : label;
}

function resolveDietLabel(diet: string | null, t: TFunction): string | null {
  if (diet == null) {
    return null;
  }
  const key = `settings.profile.foodContext.diet.${diet}`;
  const label = t(key);
  if (label !== key) {
    return label;
  }
  return t(`export.diet.${diet}`, { defaultValue: diet });
}

function resolveMovementLabel(
  type: string | null,
  value: number | null,
  period: string | null,
  t: TFunction,
  unitSystem: 'metric' | 'imperial',
): string | null {
  if (type == null || value == null || !(value > 0)) {
    return null;
  }
  const typeLabel =
    type === 'steps'
      ? t('settings.movementGoal.type.steps')
      : type === 'running_km'
        ? t('settings.movementGoal.type.runningKm')
        : t('settings.movementGoal.type.distanceKm');
  const periodLabel =
    period === 'day'
      ? t('settings.movementGoal.period.day')
      : t('settings.movementGoal.period.week');
  if (type === 'steps') {
    return t('settings.movementGoal.summary', {
      value: Math.round(value),
      unit: '',
      type: typeLabel,
      period: periodLabel,
    }).replace(/ {2,}/g, ' ');
  }
  const display = distanceKmToDisplay(value, unitSystem);
  const unit =
    unitSystem === 'imperial' ? t('onboarding.units.mi') : t('onboarding.units.km');
  return t('settings.movementGoal.summary', {
    value: display,
    unit,
    type: typeLabel,
    period: periodLabel,
  });
}

export async function fetchExportData(params: {
  userId: string;
  days: ExportDays;
  sections: ExportSections;
  lang: string;
  t: TFunction;
}): Promise<ExportData> {
  const { userId, days, sections, lang, t } = params;
  const missing = t('export.markdown.missing');
  const perSideLabel = t('training.timer.perSide');
  const { startKey, endKey } = exportRangeKeys(days);
  const keys = dateKeysInRange(startKey, endKey);

  const [
    profile,
    templates,
    workoutSessions,
    manualSessions,
    healthConnectedPref,
    weightLogs,
    healthStats,
    todayGoal,
  ] = await Promise.all([
    fetchProfileSettings(userId),
    fetchTemplates(),
    sections.training
      ? fetchWorkoutSessionsInRange(startKey, endKey)
      : Promise.resolve([]),
    sections.training
      ? fetchTrainingSessionsInRange(userId, startKey, endKey)
      : Promise.resolve([] as TrainingSession[]),
    getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY),
    sections.body
      ? supabase
          .from('weight_logs')
          .select('weight_kg, logged_at')
          .eq('user_id', userId)
          .gte('logged_at', localDayWindow(parseDateOnly(startKey)).startISO)
          .lte('logged_at', localDayWindow(parseDateOnly(endKey)).endISO)
          .order('logged_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sections.nutrition
      ? supabase
          .from('daily_health_stats')
          .select('day, active_energy_kcal')
          .eq('user_id', userId)
          .gte('day', startKey)
          .lte('day', endKey)
      : Promise.resolve({ data: [], error: null }),
    fetchCalorieGoalForDate(userId, endKey),
  ]);

  const connected = healthConnectedPref === true;
  const runningMap =
    sections.training && connected
      ? await fetchRunningKmByDay(startKey, endKey)
      : new Map<string, number>();

  if (weightLogs && 'error' in weightLogs && weightLogs.error) {
    throw weightLogs.error;
  }
  if (healthStats && 'error' in healthStats && healthStats.error) {
    throw healthStats.error;
  }

  const burnedByDay = new Map<string, number>();
  for (const row of healthStats.data ?? []) {
    const kcal = row.active_energy_kcal == null ? null : Number(row.active_energy_kcal);
    if (kcal != null && Number.isFinite(kcal) && kcal > 0) {
      burnedByDay.set(String(row.day), Math.round(kcal));
    }
  }

  const startWeightKg = await (async () => {
    const progressStart = profile.progress_start_date;
    const { data } = await supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true })
      .limit(40);
    if (!data?.length) {
      return null;
    }
    if (progressStart) {
      const match = data.find(
        (row) => localDateKey(new Date(row.logged_at)) >= progressStart,
      );
      if (match) {
        return Number(match.weight_kg);
      }
    }
    return Number(data[0]!.weight_kg);
  })();

  const nutritionDays: ExportNutritionDay[] = [];
  if (sections.nutrition) {
    for (const dateKey of keys) {
      const [meals, goal] = await Promise.all([
        fetchMealsForLocalDate(userId, dateKey),
        fetchCalorieGoalForDate(userId, dateKey),
      ]);
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      let fiber = 0;
      let totalKcal = 0;
      for (const meal of meals) {
        totalKcal += meal.total_kcal;
        protein += meal.total_protein_g;
        carbs += meal.total_carbs_g;
        fat += meal.total_fat_g;
        fiber += meal.total_fiber_g;
      }
      const hasMeals = meals.length > 0;
      nutritionDays.push({
        dateKey,
        dateLabel: formatExportDateLabel(dateKey, lang),
        totalKcal: hasMeals ? Math.round(totalKcal) : null,
        goalKcal: goal?.dailyCalorieGoal ?? null,
        burnedKcal: burnedByDay.get(dateKey) ?? null,
        protein: {
          actual: hasMeals ? macroOrNull(totalKcal, protein) : null,
          goal: goal?.proteinG ?? null,
        },
        carbs: {
          actual: hasMeals ? macroOrNull(totalKcal, carbs) : null,
          goal: goal?.carbsG ?? null,
        },
        fat: {
          actual: hasMeals ? macroOrNull(totalKcal, fat) : null,
          goal: goal?.fatG ?? null,
        },
        fiber: {
          actual: hasMeals ? macroOrNull(totalKcal, fiber) : null,
          goal: goal?.fiberG ?? null,
        },
        meals: meals
          .slice()
          .sort((a, b) => a.eaten_at.localeCompare(b.eaten_at))
          .map((meal) => ({
            timeLabel: formatTimeLabel(meal.eaten_at, lang),
            items: meal.items.map((item) => ({
              name: item.name || missing,
              amountLabel: formatItemAmount(item),
              kcal: item.kcal > 0 ? Math.round(item.kcal) : null,
            })),
          })),
      });
    }
  }

  const exportTemplates = templates.map((template) => {
    const weekdaysLabel =
      template.weekdays.length === 0
        ? t('export.markdown.trainingPlanRotating')
        : [...template.weekdays]
            .sort((a, b) => a - b)
            .map((day) => t(`supplements.schedule.weekdayShort.${day}`))
            .join(', ');
    return {
      name: template.name,
      shortLabel: template.shortLabel,
      weekdaysLabel,
      exercises: template.exercises
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((te) => ({
          name: resolveExerciseName(te.exercise, lang),
          target: formatExerciseTarget({
            sets: te.targetSets,
            kind: te.exercise.kind,
            reps: te.targetReps,
            repsMax: te.targetRepsMax,
            seconds: te.targetSeconds,
            secondsMax: te.targetSecondsMax,
            perSide: te.exercise.perSide,
            perSideLabel,
          }),
        })),
    };
  });

  const exportExerciseIds = [
    ...new Set(
      (workoutSessions ?? []).flatMap((session) =>
        session.sets
          .map((set) => set.exerciseId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ),
  ];
  const exportExercisesById = new Map<string, Exercise>();
  if (exportExerciseIds.length > 0) {
    for (const ex of await fetchExercisesByIds(exportExerciseIds)) {
      exportExercisesById.set(ex.id, ex);
    }
  }

  const workoutExport = (workoutSessions ?? []).map((session) => {
    const groups = groupSessionSets(session);
    return {
      dateLabel: formatExportDateLabel(session.loggedOn, lang),
      name: session.templateName,
      durationMin: sessionDurationFromTimestamps(session),
      intensityLabel: session.intensity
        ? t(`home.training.intensity.${session.intensity}.label`)
        : null,
      rows: groups.map((group) => ({
        exercise: displayExerciseName({
          exerciseId: group.exerciseId,
          storedName: group.exerciseName,
          exercise:
            group.exerciseId != null ? exportExercisesById.get(group.exerciseId) : undefined,
          lang,
        }),
        target: formatExerciseTarget({
          sets: group.sets.length,
          kind: group.kind,
          reps: group.targetReps,
          repsMax: group.targetRepsMax,
          seconds: group.targetSeconds,
          secondsMax: group.targetSecondsMax,
          perSide: group.perSide,
          perSideLabel,
        }),
        actual: formatActualSets(group.sets, missing),
      })),
    };
  });

  // Manual sessions that aren't already linked from a workout session
  const linkedTrainingIds = new Set(
    (workoutSessions ?? [])
      .map((session) => session.trainingSessionId)
      .filter((id): id is string => id != null),
  );
  const manualExport = (manualSessions ?? [])
    .filter((session) => !linkedTrainingIds.has(session.id))
    .map((session) => ({
      dateLabel: formatExportDateLabel(session.loggedOn, lang),
      activityLabel: t(`home.training.activity.${session.activity}`),
      durationMin: session.durationMinutes,
      intensityLabel: t(`home.training.intensity.${session.intensity}.label`),
    }));

  const runningDays = [...runningMap.entries()]
    .filter(([, km]) => km > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, km]) => ({
      dateLabel: formatExportDateLabel(dateKey, lang),
      km,
    }));

  const weightEntries = ((weightLogs as { data?: { weight_kg: number; logged_at: string }[] })
    .data ?? []).map((row) => ({
    dateLabel: formatExportDateLabel(localDateKey(new Date(row.logged_at)), lang),
    weightKg: Number(row.weight_kg),
  }));

  let progressionEvents: ExportData['progressionEvents'] = [];
  let progressionOpen: ExportData['progressionOpen'] = [];
  if (sections.training) {
    const events = await fetchProgressionEvents({
      since: `${startKey}T00:00:00.000Z`,
    });
    const allEvents = await fetchProgressionEvents();
    const accepted = events.filter((ev) => ev.status === 'accepted');
    const exerciseById = new Map<string, (typeof templates)[0]['exercises'][0]['exercise']>();
    for (const template of templates) {
      for (const te of template.exercises) {
        exerciseById.set(te.exerciseId, te.exercise);
      }
    }
    // Every exercise an event points at, whether or not it is still in a plan.
    // Without this the "from" side of a variant_up prints its raw UUID.
    const referencedIds = [
      ...allEvents.flatMap((ev) => [ev.fromExerciseId, ev.toExerciseId]),
      ...accepted.flatMap((ev) => [ev.fromExerciseId, ev.toExerciseId]),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const missingIds = referencedIds.filter((id) => !exerciseById.has(id));
    if (missingIds.length > 0) {
      try {
        for (const ex of await fetchExercisesByIds(missingIds)) {
          exerciseById.set(ex.id, ex);
        }
      } catch (error) {
        Sentry.captureException(error, { level: 'warning' });
      }
    }

    const ladderCache = new Map<string, Awaited<ReturnType<typeof fetchLadder>>>();
    async function ladderFor(key: string | null | undefined) {
      if (key == null) {
        return [];
      }
      const cached = ladderCache.get(key);
      if (cached) {
        return cached;
      }
      const ladder = await fetchLadder(key);
      ladderCache.set(key, ladder);
      for (const ex of ladder) {
        exerciseById.set(ex.id, ex);
      }
      return ladder;
    }

    progressionEvents = [];
    for (const ev of accepted) {
      let fromEx = ev.fromExerciseId ? exerciseById.get(ev.fromExerciseId) : undefined;
      let toEx = ev.toExerciseId ? exerciseById.get(ev.toExerciseId) : undefined;
      if (toEx?.ladderKey) {
        await ladderFor(toEx.ladderKey);
        toEx = exerciseById.get(ev.toExerciseId!) ?? toEx;
      }
      if (fromEx?.ladderKey) {
        await ladderFor(fromEx.ladderKey);
        fromEx = exerciseById.get(ev.fromExerciseId!) ?? fromEx;
      }
      const unknownLabel = t('export.markdown.tableExercise');
      const fromName = exerciseLabelOrFallback(fromEx, lang, unknownLabel);
      const toName = exerciseLabelOrFallback(toEx, lang, unknownLabel);
      const step = toEx?.ladderStep;
      const total =
        toEx?.ladderKey != null
          ? (await ladderFor(toEx.ladderKey)).length || step
          : step;
      const createdKey = localDateKey(new Date(ev.createdAt));
      const day = parseDateOnly(createdKey).toLocaleDateString(lang, {
        day: '2-digit',
        month: '2-digit',
      });
      const line =
        ev.kind === 'variant_up' && toName
          ? t('export.markdown.progressionEvent', {
              date: day,
              from: fromName,
              to: toName,
              step: step ?? '',
              total: total ?? '',
            })
          : t('export.markdown.progressionEventSimple', {
              date: day,
              name: toName || fromName,
              kind: ev.kind,
            });
      progressionEvents.push({
        dateLabel: day,
        line,
      });
    }

    for (const template of templates) {
      const templateEvents = allEvents.filter((ev) => ev.templateId === template.id);
      const ids = template.exercises.map((te) => te.exerciseId);
      for (const te of template.exercises) {
        if (te.exercise.progressionKind === 'none') {
          continue;
        }
        const lastForExercise = templateEvents.filter(
          (ev) =>
            ev.fromExerciseId === te.exerciseId || ev.toExerciseId === te.exerciseId,
        );
        const last = lastForExercise[0];
        if (last?.status !== 'declined') {
          continue;
        }
        const ladder = await ladderFor(te.exercise.ladderKey);
        const history = await fetchExerciseHistoryUnits(te.exerciseId);
        const suggestion = suggestProgression({
          exercise: te.exercise,
          ladder,
          currentTarget: {
            targetSets: te.targetSets,
            targetReps: te.targetReps,
            targetRepsMax: te.targetRepsMax,
            targetSeconds: te.targetSeconds,
            targetSecondsMax: te.targetSecondsMax,
          },
          history,
          templateExerciseIds: ids,
          lastEvents: lastForExercise,
        });
        if (!suggestion) {
          continue;
        }
        const name = resolveExerciseName(te.exercise, lang);
        progressionOpen.push({
          line: `${name}: ${t(suggestion.reasonKey, suggestion.reasonParams)}`,
        });
      }
    }
  }

  return {
    context: {
      goalTypeLabel: resolveGoalLabel(profile.goal_type, t),
      currentWeightKg: profile.latest_weight_kg,
      startWeightKg,
      targetWeightKg: profile.target_weight_kg,
      calorieGoal: todayGoal?.dailyCalorieGoal ?? profile.daily_calorie_goal,
      proteinG: todayGoal?.proteinG ?? null,
      carbsG: todayGoal?.carbsG ?? null,
      fatG: todayGoal?.fatG ?? null,
      fiberG: todayGoal?.fiberG ?? null,
      dietLabel: resolveDietLabel(profile.diet_preference, t),
      movementGoalLabel: resolveMovementLabel(
        profile.movement_goal_type,
        profile.movement_goal_value,
        profile.movement_goal_period,
        t,
        getStoredUnitSystem(),
      ),
      trainingSessionsPerWeek: profile.training_sessions_per_week,
      templates: exportTemplates,
    },
    nutritionDays,
    workoutSessions: workoutExport,
    manualSessions: manualExport,
    runningDays,
    weightEntries,
    progressionEvents,
    progressionOpen,
  };
}
