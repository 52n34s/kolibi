import { useQuery } from '@tanstack/react-query';

import { fetchArchivedTemplates } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useArchivedWorkoutTemplates(enabled = true) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: userId
      ? workoutQueryKeys.archivedTemplates(userId)
      : ['workout-templates-archived'],
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
    queryFn: () => fetchArchivedTemplates(),
  });
}
