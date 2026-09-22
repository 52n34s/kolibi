import * as Sentry from '@sentry/react-native';
import type { QueryClient } from '@tanstack/react-query';

import { insertTrainingSession } from '@/lib/training-sessions';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import { supabase } from '@/lib/supabase';
import {
  finishActiveSession,
  type FinishSessionParams,
  type FinishSessionResult,
} from '@/lib/workouts/finish-session';
import {
  enqueueUpsertSession,
  enqueueUpsertSets,
  flushWorkoutSyncQueue,
  getWorkoutSyncQueue,
} from '@/lib/workouts/sync-queue-runtime';
import type { ActiveSession } from '@/lib/workouts/types';
import { upsertWorkoutSession } from '@/lib/workouts/workouts-api';

async function fetchLatestWeightKg(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    Sentry.captureException(error);
    throw error;
  }
  const weightKg = data?.weight_kg == null ? null : Number(data.weight_kg);
  if (weightKg == null || !Number.isFinite(weightKg) || !(weightKg > 0)) {
    const missing = new Error('missing_weight_kg');
    Sentry.captureException(missing);
    throw missing;
  }
  return weightKg;
}

/** Shared finish path for live sessions and backfill (queue → training_sessions → link). */
export async function runFinishActiveSession(
  active: ActiveSession,
  params: FinishSessionParams,
): Promise<FinishSessionResult> {
  return finishActiveSession(active, params, {
    flush: flushWorkoutSyncQueue,
    peekQueueLength: () => getWorkoutSyncQueue().peek().length,
    enqueueUpsertSession,
    enqueueUpsertSets,
    fetchLatestWeightKg,
    insertTrainingSession,
    upsertWorkoutSession,
    invalidateTrainingQueries,
    captureException: (error) => {
      Sentry.captureException(error);
    },
  });
}

export async function fetchWeightKgForTraining(userId: string): Promise<number> {
  return fetchLatestWeightKg(userId);
}

export type { QueryClient };
