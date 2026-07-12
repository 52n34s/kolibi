import { useQuery } from '@tanstack/react-query';

import { fetchHistoryData, resolveHistoryPreviewData } from '@/lib/history';

export function useHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['history', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      const data = await fetchHistoryData(userId);
      return resolveHistoryPreviewData(data);
    },
  });
}
