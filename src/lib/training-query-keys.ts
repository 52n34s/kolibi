import type { QueryClient } from '@tanstack/react-query';

import {
  trainingSessionQueryKeys,
  workoutQueryKeys,
} from '@/lib/workouts/query-keys';

/**
 * Invalidate home / sport-energy / manual training_sessions / workout logger queries
 * after training writes.
 */
export async function invalidateTrainingQueries(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
    queryClient.invalidateQueries({ queryKey: ['sport-energy-day-today', userId] }),
    queryClient.invalidateQueries({ queryKey: ['sport-energy-day', userId] }),
    queryClient.invalidateQueries({ queryKey: ['day-summary-profile', userId] }),
    queryClient.invalidateQueries({ queryKey: trainingSessionQueryKeys.week(userId) }),
    queryClient.invalidateQueries({ queryKey: trainingSessionQueryKeys.day(userId) }),
    queryClient.invalidateQueries({ queryKey: trainingSessionQueryKeys.range(userId) }),
    queryClient.invalidateQueries({ queryKey: workoutQueryKeys.exercises(userId) }),
    queryClient.invalidateQueries({ queryKey: workoutQueryKeys.templates(userId) }),
    queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.archivedTemplates(userId),
    }),
    queryClient.invalidateQueries({ queryKey: workoutQueryKeys.ownTemplates(userId) }),
    queryClient.invalidateQueries({
      queryKey: ['workout-sessions-range', userId],
    }),
    queryClient.invalidateQueries({
      queryKey: ['workout-exercise-history', userId],
    }),
    queryClient.invalidateQueries({
      queryKey: ['workout-session', userId],
    }),
    queryClient.invalidateQueries({ queryKey: ['workout-ladder'] }),
    queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.progressionEvents(userId),
    }),
    queryClient.invalidateQueries({ queryKey: ['history', userId] }),
  ]);
}
