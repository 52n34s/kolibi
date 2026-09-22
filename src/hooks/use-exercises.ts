import { useQuery } from '@tanstack/react-query';

import { fetchExercises } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useExercises(enabled = true) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: userId ? workoutQueryKeys.exercises(userId) : ['workout-exercises'],
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
    queryFn: () => fetchExercises(),
  });
}
