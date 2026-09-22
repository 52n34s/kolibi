import { useQuery } from '@tanstack/react-query';

import { fetchExerciseHistory } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useExerciseHistory(params: {
  exerciseId: string | undefined;
  limit?: number;
  enabled?: boolean;
}) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled =
    params.enabled !== false && Boolean(userId) && Boolean(params.exerciseId);

  return useQuery({
    queryKey:
      userId && params.exerciseId
        ? workoutQueryKeys.exerciseHistory(userId, params.exerciseId)
        : ['workout-exercise-history'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchExerciseHistory(params.exerciseId!, params.limit),
  });
}
