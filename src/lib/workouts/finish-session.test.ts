import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { QueryClient } from '@tanstack/react-query';

import { finishActiveSession, type FinishSessionDeps } from './finish-session.ts';
import { buildActiveSessionFromTemplate, completeCurrentSet } from './session-logic.ts';
import type { Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

function exercise(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'kind'>): Exercise {
  return {
    userId: null,
    catalogSlug: null,
    names: { de: partial.id, en: partial.id },
    perSide: false,
    defaultSets: 1,
    defaultReps: 8,
    defaultRepsMax: null,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 60,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'none',
    timeCapSeconds: null,
    ...partial,
  };
}

function makeSession() {
  const te: TemplateExercise = {
    id: 'te1',
    exerciseId: 'e1',
    exercise: exercise({ id: 'e1', kind: 'reps' }),
    position: 0,
    targetSets: 1,
    targetReps: 8,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: 60,
  };
  const template: WorkoutTemplate = {
    id: 'tmpl',
    name: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo',
    weekdays: [],
    position: 0,
    exercises: [te],
  };
  let session = buildActiveSessionFromTemplate(template, {
    loggedOn: '2026-09-22',
    startedAt: '2026-09-22T09:00:00.000Z',
  });
  const done = completeCurrentSet(session, '2026-09-22T09:30:00.000Z');
  assert.ok(done);
  return done.session;
}

function baseDeps(overrides: Partial<FinishSessionDeps> = {}): FinishSessionDeps {
  return {
    enqueueUpsertSession: () => {},
    enqueueUpsertSets: () => {},
    flush: async () => {},
    peekQueueLength: () => 0,
    fetchLatestWeightKg: async () => 80,
    insertTrainingSession: async () => ({ id: 'ts-1' }),
    upsertWorkoutSession: async () => {},
    invalidateTrainingQueries: async () => {},
    captureException: () => {},
    ...overrides,
  };
}

describe('finishActiveSession', () => {
  it('runs flush → insert → link, then clears on success', async () => {
    const order: string[] = [];
    const deps = baseDeps({
      enqueueUpsertSession: () => {
        order.push('enqueueSession');
      },
      enqueueUpsertSets: () => {
        order.push('enqueueSets');
      },
      flush: async () => {
        order.push('flush');
      },
      peekQueueLength: () => {
        order.push('peek');
        return 0;
      },
      fetchLatestWeightKg: async () => {
        order.push('weight');
        return 80;
      },
      insertTrainingSession: async (params) => {
        order.push(`insert:${params.activity}:${params.durationMinutes}:${params.intensity}`);
        return { id: 'ts-1' };
      },
      upsertWorkoutSession: async (input) => {
        order.push(`link:${input.trainingSessionId}`);
      },
      invalidateTrainingQueries: async () => {
        order.push('invalidate');
      },
    });

    const result = await finishActiveSession(
      makeSession(),
      {
        intensity: 'normal',
        userId: 'u1',
        queryClient: {} as QueryClient,
        finishedAt: '2026-09-22T09:30:00.000Z',
      },
      deps,
    );

    assert.equal(result.ok, true);
    assert.equal(result.session, null);
    assert.deepEqual(order, [
      'enqueueSession',
      'enqueueSets',
      'flush',
      'peek',
      'weight',
      'insert:strength:30:normal',
      'link:ts-1',
      'invalidate',
    ]);
  });

  it('keeps the finished session when insert fails', async () => {
    const deps = baseDeps({
      insertTrainingSession: async () => {
        throw new Error('insert_failed');
      },
      upsertWorkoutSession: async () => {
        throw new Error('should_not_link');
      },
    });

    const active = makeSession();
    const result = await finishActiveSession(
      active,
      {
        intensity: 'hard',
        userId: 'u1',
        queryClient: {} as QueryClient,
      },
      deps,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.session);
      assert.equal(result.session!.intensity, 'hard');
      assert.ok(result.session!.finishedAt);
      assert.equal(result.session!.sessionId, active.sessionId);
      assert.equal(result.session!.trainingSessionId, null);
      assert.match(String(result.error), /insert_failed/);
    }
  });

  it('skips insert when trainingSessionId is already set', async () => {
    const order: string[] = [];
    const deps = baseDeps({
      insertTrainingSession: async () => {
        order.push('insert');
        return { id: 'should-not' };
      },
      upsertWorkoutSession: async (input) => {
        order.push(`link:${input.trainingSessionId}`);
      },
      invalidateTrainingQueries: async () => {
        order.push('invalidate');
      },
    });

    const active = { ...makeSession(), trainingSessionId: 'ts-existing' };
    const result = await finishActiveSession(
      active,
      {
        intensity: 'easy',
        userId: 'u1',
        queryClient: {} as QueryClient,
        finishedAt: '2026-09-22T09:30:00.000Z',
      },
      deps,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(order, ['link:ts-existing', 'invalidate']);
  });

  it('fails when flush leaves ops in the queue', async () => {
    const deps = baseDeps({
      peekQueueLength: () => 1,
      insertTrainingSession: async () => {
        throw new Error('should_not_insert');
      },
    });

    const active = makeSession();
    const result = await finishActiveSession(
      active,
      {
        intensity: 'normal',
        userId: 'u1',
        queryClient: {} as QueryClient,
      },
      deps,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(String(result.error), /sync_queue_not_empty/);
      assert.equal(result.session?.sessionId, active.sessionId);
    }
  });

  it('uses durationMinutes override for training insert', async () => {
    let insertedDuration: number | null = null;
    const session = makeSession();
    const result = await finishActiveSession(
      session,
      {
        intensity: 'hard',
        userId: 'u1',
        queryClient: {} as QueryClient,
        durationMinutes: 55,
      },
      baseDeps({
        insertTrainingSession: async (params) => {
          insertedDuration = params.durationMinutes;
          return { id: 'ts-2' };
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(insertedDuration, 55);
  });
});
