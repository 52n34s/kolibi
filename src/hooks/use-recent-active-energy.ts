import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { fetchRecentActiveEnergy } from '@/lib/daily-health-stats';

/** Mean active energy behind the expected-maintenance reference. */
export function useRecentActiveEnergy(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['recent-active-energy', userId, localDateKey()],
    enabled: !!userId && enabled,
    queryFn: () => fetchRecentActiveEnergy(userId!),
  });
}
