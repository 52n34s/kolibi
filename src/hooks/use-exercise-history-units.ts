import { useQuery } from '@tanstack/react-query';

import { fetchExerciseHistoryUnits } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useExerciseHistoryUnits(params: {
  exerciseId: string | undefined;
  limitSessions?: number;
  enabled?: boolean;
}) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled =
    params.enabled !== false && Boolean(userId) && Boolean(params.exerciseId);

  return useQuery({
    queryKey:
      userId && params.exerciseId
        ? [...workoutQueryKeys.exerciseHistory(userId, params.exerciseId), 'units']
        : ['workout-exercise-history-units'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchExerciseHistoryUnits(params.exerciseId!, params.limitSessions ?? 20),
  });
}
