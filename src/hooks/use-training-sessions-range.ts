import { useQuery } from '@tanstack/react-query';

import { fetchTrainingSessionsInRange } from '@/lib/training-sessions';

export function useTrainingSessionsRange(params: {
  userId: string | undefined;
  startKey: string;
  endKey: string;
  enabled?: boolean;
}) {
  const enabled = params.enabled !== false && Boolean(params.userId);

  return useQuery({
    queryKey: [
      'training-sessions-range',
      params.userId,
      params.startKey,
      params.endKey,
    ],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchTrainingSessionsInRange(params.userId!, params.startKey, params.endKey),
  });
}
