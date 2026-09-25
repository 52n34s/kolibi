import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { shouldKeepScreenAwake } from '@/lib/workouts/keep-awake';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

const TRAINING_KEEP_AWAKE_TAG = 'kolibi-training-session';

/**
 * Keep the screen awake while a workout session is active, whichever tab or
 * screen is showing. Mounted once in AppLifecycle; the native module releases
 * the lock in the background and restores it on return.
 */
export function useTrainingKeepAwake(): void {
  const keepAwake = useWorkoutSessionStore((s) => shouldKeepScreenAwake(s.active));

  useEffect(() => {
    if (!keepAwake) {
      void deactivateKeepAwake(TRAINING_KEEP_AWAKE_TAG);
      return;
    }
    void activateKeepAwakeAsync(TRAINING_KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(TRAINING_KEEP_AWAKE_TAG);
    };
  }, [keepAwake]);
}
