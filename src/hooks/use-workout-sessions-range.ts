import { useQuery } from '@tanstack/react-query';

import { fetchWorkoutSessionsInRange } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useWorkoutSessionsRange(params: {
  startKey: string;
  endKey: string;
  enabled?: boolean;
}) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled = params.enabled !== false && Boolean(userId);

  return useQuery({
    queryKey: userId
      ? workoutQueryKeys.sessionsRange(userId, params.startKey, params.endKey)
      : ['workout-sessions-range'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchWorkoutSessionsInRange(params.startKey, params.endKey),
  });
}
