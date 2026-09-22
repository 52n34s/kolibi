import { useQuery } from '@tanstack/react-query';

import { fetchExerciseBestsBefore } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

/** Max set value per exercise_id before `beforeKey` (exclusive logged_on). */
export function useExerciseBestsBefore(params: {
  beforeKey: string;
  enabled?: boolean;
}) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled = params.enabled !== false && Boolean(userId) && Boolean(params.beforeKey);

  return useQuery({
    queryKey:
      userId != null
        ? workoutQueryKeys.exerciseBestsBefore(userId, params.beforeKey)
        : ['workout-exercise-bests-before'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchExerciseBestsBefore(params.beforeKey),
  });
}
