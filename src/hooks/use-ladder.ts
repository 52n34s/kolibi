import { useQuery } from '@tanstack/react-query';

import { fetchLadder } from '@/lib/workouts/workouts-api';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';

export function useLadder(ladderKey: string | null | undefined) {
  return useQuery({
    queryKey: ladderKey ? workoutQueryKeys.ladder(ladderKey) : ['workout-ladder'],
    enabled: Boolean(ladderKey),
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchLadder(ladderKey!),
  });
}
