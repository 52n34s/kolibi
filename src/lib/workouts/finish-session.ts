import type { QueryClient } from '@tanstack/react-query';

import {
  allDoneSetUpserts,
  markSessionFinished,
  sessionDurationMinutes,
  type SessionSetUpsertPayload,
} from './session-logic';
import type { ActiveSession, GymIntensity } from './types';

export type FinishSessionParams = {
  intensity: GymIntensity;
  userId: string;
  queryClient: QueryClient;
  /** Optional override for tests / backdated finishes. */
  finishedAt?: string;
  /**
   * Override duration for training_sessions insert (e.g. backfill).
   * When omitted, derived from startedAt → finishedAt.
   */
  durationMinutes?: number;
};

export type FinishSessionDeps = {
  flush: () => Promise<void>;
  peekQueueLength: () => number;
  enqueueUpsertSession: (payload: {
    id: string;
    templateId: string | null;
    templateName: string;
    shortLabel: string;
    colorKey: ActiveSession['colorKey'];
    loggedOn: string;
    startedAt: string;
    finishedAt?: string | null;
    intensity?: GymIntensity | null;
    trainingSessionId?: string | null;
  }) => void;
  enqueueUpsertSets: (sets: SessionSetUpsertPayload[]) => void;
  fetchLatestWeightKg: (userId: string) => Promise<number>;
  insertTrainingSession: (params: {
    userId: string;
    loggedOn: string;
    activity: 'strength';
    durationMinutes: number;
    intensity: GymIntensity;
    weightKg: number;
  }) => Promise<{ id: string }>;
  upsertWorkoutSession: (input: {
    id: string;
    templateId: string | null;
    templateName: string;
    shortLabel: string;
    colorKey: ActiveSession['colorKey'];
    loggedOn: string;
    startedAt: string;
    finishedAt?: string | null;
    intensity?: GymIntensity | null;
    trainingSessionId?: string | null;
  }) => Promise<unknown>;
  invalidateTrainingQueries: (queryClient: QueryClient, userId: string) => Promise<void>;
  captureException: (error: unknown) => void;
};

export type FinishSessionResult =
  | { ok: true; session: null }
  | { ok: false; error: unknown; session: ActiveSession | null };

/**
 * a) queue finished+intensity
 * b) flush (must drain)
 * c) insert training_sessions unless trainingSessionId already set
 * d) link training_session_id
 * e) invalidate + clear
 */
export async function finishActiveSession(
  active: ActiveSession,
  params: FinishSessionParams,
  deps: FinishSessionDeps,
): Promise<FinishSessionResult> {
  let finished = markSessionFinished(active, params.intensity, params.finishedAt);
  const durationMinutes =
    params.durationMinutes != null &&
    Number.isFinite(params.durationMinutes) &&
    params.durationMinutes > 0
      ? Math.round(params.durationMinutes)
      : sessionDurationMinutes(finished);

  deps.enqueueUpsertSession({
    id: finished.sessionId,
    templateId: finished.templateId,
    templateName: finished.templateName,
    shortLabel: finished.shortLabel,
    colorKey: finished.colorKey,
    loggedOn: finished.loggedOn,
    startedAt: finished.startedAt,
    finishedAt: finished.finishedAt,
    intensity: finished.intensity,
    trainingSessionId: finished.trainingSessionId,
  });
  deps.enqueueUpsertSets(allDoneSetUpserts(finished));

  try {
    await deps.flush();
    if (deps.peekQueueLength() > 0) {
      const error = new Error('sync_queue_not_empty');
      deps.captureException(error);
      return { ok: false, error, session: finished };
    }

    let trainingSessionId = finished.trainingSessionId;
    if (!trainingSessionId) {
      const weightKg = await deps.fetchLatestWeightKg(params.userId);
      const training = await deps.insertTrainingSession({
        userId: params.userId,
        loggedOn: finished.loggedOn,
        activity: 'strength',
        durationMinutes,
        intensity: params.intensity,
        weightKg,
      });
      trainingSessionId = training.id;
      finished = { ...finished, trainingSessionId };
    }

    await deps.upsertWorkoutSession({
      id: finished.sessionId,
      templateId: finished.templateId,
      templateName: finished.templateName,
      shortLabel: finished.shortLabel,
      colorKey: finished.colorKey,
      loggedOn: finished.loggedOn,
      startedAt: finished.startedAt,
      finishedAt: finished.finishedAt,
      intensity: finished.intensity,
      trainingSessionId,
    });

    await deps.invalidateTrainingQueries(params.queryClient, params.userId);
    return { ok: true, session: null };
  } catch (error) {
    deps.captureException(error);
    return { ok: false, error, session: finished };
  }
}
