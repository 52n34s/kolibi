import { useQuery } from '@tanstack/react-query';

import { fetchDietPreference } from '@/lib/profile';

const DIET_PREFERENCE_STALE_MS = 5 * 60 * 1000;

export function useDietPreference(userId: string | undefined) {
  return useQuery({
    queryKey: ['diet-preference', userId],
    enabled: Boolean(userId),
    staleTime: DIET_PREFERENCE_STALE_MS,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return fetchDietPreference(userId);
    },
  });
}
