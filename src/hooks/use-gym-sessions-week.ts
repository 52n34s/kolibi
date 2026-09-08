import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import { fetchGymSessionsForWeek } from '@/lib/gym-sessions';
import { useAuthStore } from '@/stores/auth-store';

export function useGymSessionsWeek() {
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['gym-sessions-week', userId, localDateKey()],
    enabled: Boolean(userId),
    queryFn: () => fetchGymSessionsForWeek(userId!),
  });
}
