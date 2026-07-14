import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { getActiveEnergyBurnedToday, isHealthConnected } from '@/lib/health';
import { useAuthStore } from '@/stores/auth-store';

export function useActiveEnergyBurnedToday(enabled: boolean) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: ['active-energy-burned-today', userId, localDateKey()],
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      if (!(await isHealthConnected())) {
        return null;
      }

      return getActiveEnergyBurnedToday();
    },
  });
}
