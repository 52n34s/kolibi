import { useMemo } from 'react';

import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { localDateKey, shiftLocalDateKey } from '@/lib/day-window';
import { lastSetsByExercise, type LastSetsByExercise } from '@/lib/workouts/set-prefill';

/**
 * Last finished sets per exercise_id for prefilling a new session. Same 90-day
 * range as the training tab, so the query is usually cached already.
 */
export function useLastSetsByExercise(): LastSetsByExercise {
  const todayKey = localDateKey();
  const { data: sessions } = useWorkoutSessionsRange({
    startKey: shiftLocalDateKey(todayKey, -90),
    endKey: todayKey,
  });
  return useMemo(() => lastSetsByExercise(sessions ?? []), [sessions]);
}
