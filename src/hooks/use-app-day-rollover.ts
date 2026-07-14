import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { localDateKey } from '@/lib/day-window';
import { syncProfileTimezone } from '@/lib/profile-timezone';

function invalidateDayScopedQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  void queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
  void queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
  void queryClient.invalidateQueries({ queryKey: ['history', userId] });
  void queryClient.invalidateQueries({ queryKey: ['active-energy-burned-today', userId] });
}

export function useAppDayRollover(userId: string | null) {
  const queryClient = useQueryClient();
  const dateKeyRef = useRef(localDateKey());

  useEffect(() => {
    if (!userId) {
      return;
    }

    void syncProfileTimezone(userId);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      const currentDateKey = localDateKey();
      if (currentDateKey !== dateKeyRef.current) {
        dateKeyRef.current = currentDateKey;
      }

      invalidateDayScopedQueries(queryClient, userId);
      void syncProfileTimezone(userId);
    });

    return () => subscription.remove();
  }, [queryClient, userId]);
}
