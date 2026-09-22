import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * 250 ms tick while `enabled`. Stops in background; refreshes `now` on foreground
 * so timestamp-based timers stay accurate.
 */
export function useTimerTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
    }, 250);

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(Date.now());
      }
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [enabled]);

  return now;
}
