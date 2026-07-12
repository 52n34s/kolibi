import { useQuery } from '@tanstack/react-query';

import { fetchHomeDashboard } from '@/lib/home';
import { useAuthStore } from '@/stores/auth-store';

export function useHomeDashboard() {
  const userId = useAuthStore((state) => state.session?.user?.id);

  return useQuery({
    queryKey: ['home-dashboard', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('Missing authenticated user');
      }

      return fetchHomeDashboard(userId);
    },
    enabled: !!userId,
  });
}
