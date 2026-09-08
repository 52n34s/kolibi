import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { getSportEnergyDay } from '@/lib/health';
import { useAuthStore } from '@/stores/auth-store';

export function useSportEnergyDayToday(
  enabled: boolean,
  ageYears: number | null,
) {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: ['sport-energy-day-today', userId, localDateKey(), ageYears],
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    queryFn: async () => getSportEnergyDay({ ageYears, userId }),
  });
}
