import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useExerciseBestsBefore } from '@/hooks/use-exercise-bests-before';
import { useExercises } from '@/hooks/use-exercises';
import { useProgressionEvents } from '@/hooks/use-progression-events';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { fetchBuildUpBodyData, hasBodyMeasurementsTable } from '@/lib/body-measurements';
import {
  BUILD_UP_AVERAGE_DAYS,
  BUILD_UP_BASELINE_LOOKBACK_DAYS,
  buildUpStartKey,
  computeBuildUp,
  shiftDayKey,
  type BuildUpSummary,
  type BuildUpWeeks,
} from '@/lib/build-up';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { displayExerciseName } from '@/lib/workouts/exercise-name';
import { useAuthStore } from '@/stores/auth-store';

/** Under ['history', userId] so every weight / waist save refreshes it too. */
export function buildUpBodyQueryKey(userId: string, sinceKey: string) {
  return ['history', userId, 'build-up-body', sinceKey] as const;
}

/** True once migration 20260926153500 ran; the measurements sheet shows only then. */
export function useBodyMeasurementsAvailable(enabled = true) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const query = useQuery({
    queryKey: ['body-measurements-table'],
    enabled: Boolean(userId) && enabled,
    staleTime: Infinity,
    queryFn: () => hasBodyMeasurementsTable(),
  });
  return query.data === true;
}

export function useBuildUp(weeks: BuildUpWeeks, enabled = true) {
  const { i18n } = useTranslation();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const todayKey = localDateKey();
  const startKey = buildUpStartKey(todayKey, weeks);
  // One fetch for all three windows: 12 weeks plus the longest baseline lookback.
  const sinceKey = shiftDayKey(
    buildUpStartKey(todayKey, 12),
    -Math.max(BUILD_UP_BASELINE_LOOKBACK_DAYS, BUILD_UP_AVERAGE_DAYS - 1),
  );
  const active = enabled && Boolean(userId);

  const body = useQuery({
    queryKey: userId ? buildUpBodyQueryKey(userId, sinceKey) : ['build-up-body'],
    enabled: active,
    staleTime: 60 * 1000,
    queryFn: () => fetchBuildUpBodyData(userId!, sinceKey),
  });
  const { data: sessions = [] } = useWorkoutSessionsRange({
    startKey,
    endKey: todayKey,
    enabled: active,
  });
  const { data: beforeBests = {} } = useExerciseBestsBefore({ beforeKey: startKey, enabled: active });
  const { data: events = [] } = useProgressionEvents({
    since: parseDateOnly(startKey).toISOString(),
    enabled: active,
  });
  const { data: exercises = [] } = useExercises(active);

  const summary = useMemo((): BuildUpSummary | null => {
    if (!body.data) {
      return null;
    }
    const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const result = computeBuildUp({
      todayKey,
      weeks,
      weightKg: body.data.weightKg,
      waistCm: body.data.waistCm,
      chestCm: body.data.chestCm,
      armCm: body.data.armCm,
      sessions,
      beforeBests,
      progressionEvents: events.map((event) => ({
        kind: event.kind,
        status: event.status,
        day: localDateKey(new Date(event.createdAt)),
      })),
    });
    return {
      ...result,
      exerciseGains: result.exerciseGains.map((gain) => ({
        ...gain,
        exerciseName: displayExerciseName({
          exerciseId: gain.exerciseId,
          storedName: gain.exerciseName,
          exercise: exercisesById.get(gain.exerciseId),
          lang: i18n.language,
        }),
      })),
    };
  }, [beforeBests, body.data, events, exercises, i18n.language, sessions, todayKey, weeks]);

  return {
    summary,
    measuredOn: body.data?.measuredOn ?? [],
    isLoading: body.isLoading,
  };
}
