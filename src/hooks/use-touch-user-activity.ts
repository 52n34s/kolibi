import { useEffect } from 'react';
import { AppState } from 'react-native';

import { touchUserActivityThrottled } from '@/lib/user-activity';

/** Foreground heartbeat for last_active_at (throttled to once per 5 minutes). */
export function useTouchUserActivity(userId: string | null) {
  useEffect(() => {
    if (!userId) {
      return;
    }

    void touchUserActivityThrottled(userId);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void touchUserActivityThrottled(userId);
    });

    return () => subscription.remove();
  }, [userId]);
}
