import { useQuery } from '@tanstack/react-query';

import { fetchTemplates } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useWorkoutTemplates(enabled = true) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: userId ? workoutQueryKeys.templates(userId) : ['workout-templates'],
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
    queryFn: () => fetchTemplates(),
  });
}
