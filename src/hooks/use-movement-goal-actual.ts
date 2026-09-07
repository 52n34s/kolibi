import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { getMovementActual } from '@/lib/health';
import type { MovementGoalPeriod, MovementGoalType } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

export function useMovementGoalActual(params: {
  enabled: boolean;
  type: MovementGoalType | null | undefined;
  period: MovementGoalPeriod | null | undefined;
}) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const type = params.type ?? null;
  const period = params.period ?? null;

  return useQuery({
    queryKey: ['movement-goal-actual', userId, type, period, localDateKey()],
    enabled: params.enabled && !!userId && type != null && period != null,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      if (type == null || period == null) {
        return null;
      }
      return getMovementActual({ type, period });
    },
  });
}
