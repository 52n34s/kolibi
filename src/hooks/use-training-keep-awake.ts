import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TRAINING_KEEP_AWAKE_TAG = 'kolibi-training-session';

/**
 * Keep the screen awake only while a workout session is active.
 * Wire from TrainingPanel (Block 7) with `active != null`.
 */
export function useTrainingKeepAwake(sessionActive: boolean): void {
  useEffect(() => {
    if (!sessionActive) {
      void deactivateKeepAwake(TRAINING_KEEP_AWAKE_TAG);
      return;
    }
    void activateKeepAwakeAsync(TRAINING_KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(TRAINING_KEEP_AWAKE_TAG);
    };
  }, [sessionActive]);
}
