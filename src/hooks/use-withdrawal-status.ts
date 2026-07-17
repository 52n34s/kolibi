import { useQuery } from '@tanstack/react-query';

import { hasExistingWithdrawal } from '@/lib/withdrawal';

export function useWithdrawalStatus(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['withdrawal-status', userId],
    enabled: Boolean(userId) && enabled,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return hasExistingWithdrawal(userId);
    },
  });
}
