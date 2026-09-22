import { useQuery } from '@tanstack/react-query';

import { fetchWorkoutSessionById } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useWorkoutSession(sessionId: string | undefined) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled = Boolean(userId) && Boolean(sessionId);

  return useQuery({
    queryKey:
      userId && sessionId
        ? workoutQueryKeys.sessionDetail(userId, sessionId)
        : ['workout-session'],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchWorkoutSessionById(sessionId!),
  });
}
