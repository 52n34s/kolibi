import { useQuery } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import {
  fetchHistoryData,
  resolveHistoryPreviewData,
  type HistoryRangeDays,
} from '@/lib/history';

export function useHistory(userId: string | undefined, rangeDays: HistoryRangeDays = 7) {
  return useQuery({
    queryKey: ['history', userId, rangeDays, localDateKey()],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      const data = await fetchHistoryData(userId, rangeDays);
      return resolveHistoryPreviewData(data);
    },
  });
}
