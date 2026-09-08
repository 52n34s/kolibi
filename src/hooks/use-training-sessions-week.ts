import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { fetchTrainingSessionsForWeek } from '@/lib/training-sessions';
import { useAuthStore } from '@/stores/auth-store';

export function useTrainingSessionsWeek(enabled = true) {
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['training-sessions-week', userId, localDateKey()],
    enabled: Boolean(userId) && enabled,
    queryFn: () => fetchTrainingSessionsForWeek(userId!),
  });
}
