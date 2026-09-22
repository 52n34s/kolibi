import { useQuery } from '@tanstack/react-query';

import {
  fetchProgressionEvents,
  type FetchProgressionEventsParams,
} from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export function useProgressionEvents(
  params: FetchProgressionEventsParams & { enabled?: boolean } = {},
) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const enabled = params.enabled !== false && Boolean(userId);

  return useQuery({
    queryKey: userId
      ? [
          ...workoutQueryKeys.progressionEvents(userId),
          params.templateId ?? null,
          params.exerciseId ?? null,
          params.since ?? null,
        ]
      : ['workout-progression-events'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: () =>
      fetchProgressionEvents({
        templateId: params.templateId,
        exerciseId: params.exerciseId,
        since: params.since,
      }),
  });
}
