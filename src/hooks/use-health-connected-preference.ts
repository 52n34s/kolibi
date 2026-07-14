import { useQuery } from '@tanstack/react-query';

import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
} from '@/lib/user-preferences';

export function useHealthConnectedPreference(userId: string | undefined) {
  return useQuery({
    queryKey: ['health-connected-preference', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
    },
  });
}
