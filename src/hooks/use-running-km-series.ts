import { useQuery } from '@tanstack/react-query';

import { getRunningKmByDay } from '@/lib/health';
import { parseDateOnly } from '@/lib/day-window';

export function useRunningKmSeries(params: {
  userId: string | undefined;
  startKey: string;
  endKey: string;
  enabled?: boolean;
}) {
  const enabled = params.enabled === true && Boolean(params.userId);

  return useQuery({
    queryKey: ['running-km-series', params.userId, params.startKey, params.endKey],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    queryFn: () => {
      const start = parseDateOnly(params.startKey);
      start.setHours(0, 0, 0, 0);
      const end = parseDateOnly(params.endKey);
      end.setHours(23, 59, 59, 999);
      return getRunningKmByDay({ start, end });
    },
  });
}
