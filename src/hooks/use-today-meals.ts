import { useQuery } from '@tanstack/react-query';

import { fetchTodayMeals } from '@/lib/meals';
import { useAuthStore } from '@/stores/auth-store';

export function useTodayMeals() {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: ['today-meals', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('Missing authenticated user');
      }

      return fetchTodayMeals(userId);
    },
    enabled: !!userId,
  });
}
