import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildActiveSessionFromTemplate,
  completeCurrentSet,
  enterSummaryAt,
  markSessionFinished,
  resumeFromSummary,
  sessionDurationMinutes,
  sessionEndIso,
  SESSION_DURATION_MAX_MINUTES,
} from './session-logic.ts';
import type { ActiveSession, Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

const START = '2026-09-22T09:00:00.000Z';

function exercise(id: string): Exercise {
  return {
    id,
    userId: null,
    catalogSlug: null,
    names: { de: id },
    kind: 'reps',
    perSide: false,
    defaultSets: 2,
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
  };
}

function templateExercise(id: string, position: number): TemplateExercise {
  return {
    id: `te-${id}`,
    exerciseId: id,
    exercise: exercise(id),
    position,
    targetSets: 2,
    targetReps: 8,
    targetRepsMax: null,
    targetSeconds: null,
    targetSecondsMax: null,
    targetWeightKg: null,
    restSeconds: 60,
  };
}

function session(): ActiveSession {
  const template: WorkoutTemplate = {
    id: 'tmpl',
    name: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo',
    weekdays: [],
    position: 0,
    exercises: [templateExercise('a', 0), templateExercise('b', 1)],
  };
  return buildActiveSessionFromTemplate(template, { loggedOn: '2026-09-22', startedAt: START });
}

/** Complete sets at the given minutes after START, in cursor order. */
function withSetsAt(minutes: number[]): ActiveSession {
  let current = session();
  for (const minute of minutes) {
    const done = completeCurrentSet(
      current,
      new Date(Date.parse(START) + minute * 60_000).toISOString(),
    );
    assert.ok(done);
    current = done.session;
  }
  return current;
}

const at = (minute: number) => new Date(Date.parse(START) + minute * 60_000).toISOString();

describe('sessionEndIso', () => {
  it('ends at the last completed set, not when the summary was left open for 3 h', () => {
    const done = withSetsAt([5, 10, 20, 30]);
    assert.equal(done.phase, 'summary');
    assert.equal(sessionEndIso(done, at(30 + 180)), at(30));
  });

  it('takes the latest set across exercises, also after reordering', () => {
    const done = withSetsAt([5, 40, 10]);
    assert.equal(sessionEndIso(done, at(200)), at(40));
  });

  it('without a completed set ends when the summary opened', () => {
    const opened = enterSummaryAt(session(), at(12));
    assert.equal(sessionEndIso(opened, at(200)), at(12));
  });

  it('falls back to now for a persisted session without summaryOpenedAt', () => {
    const old: ActiveSession = { ...session(), phase: 'summary' };
    delete old.summaryOpenedAt;
    assert.equal(sessionEndIso(old, at(25)), at(25));
  });

  it(`caps the end at ${SESSION_DURATION_MAX_MINUTES} min after the start`, () => {
    const done = withSetsAt([5, 10, 20, 593]);
    assert.equal(sessionEndIso(done, at(600)), at(SESSION_DURATION_MAX_MINUTES));
  });

  it('never ends before the start', () => {
    const opened = enterSummaryAt(session(), '2026-09-22T08:00:00.000Z');
    assert.equal(sessionEndIso(opened, at(10)), START);
  });
});

describe('markSessionFinished', () => {
  it('stores the last completed set as finishedAt', () => {
    const finished = markSessionFinished(withSetsAt([5, 10, 20, 30]), 'normal');
    assert.equal(finished.finishedAt, at(30));
  });

  it('keeps an explicit finishedAt (backfill)', () => {
    const finished = markSessionFinished(withSetsAt([5]), 'normal', at(45));
    assert.equal(finished.finishedAt, at(45));
  });
});

describe('sessionDurationMinutes', () => {
  it('does not count a summary left open', () => {
    assert.equal(sessionDurationMinutes(withSetsAt([5, 10, 20, 30]), at(210)), 30);
  });

  it(`is ${SESSION_DURATION_MAX_MINUTES} at most`, () => {
    assert.equal(sessionDurationMinutes(withSetsAt([5, 10, 20, 593])), 300);
  });
});

describe('summary open and resume', () => {
  it('the last set opens the summary at its own time', () => {
    const done = withSetsAt([5, 10, 20, 30]);
    assert.equal(done.summaryOpenedAt, at(30));
  });

  it('"Zurück zur Einheit" clears finishedAt and summaryOpenedAt', () => {
    const opened = { ...enterSummaryAt(withSetsAt([5]), at(8)), finishedAt: at(8) };
    const resumed = resumeFromSummary(opened);
    assert.equal(resumed.phase, 'active');
    assert.equal(resumed.finishedAt, null);
    assert.equal(resumed.summaryOpenedAt, null);
  });

  it('after resuming, a new last set becomes the end', () => {
    const resumed = resumeFromSummary(enterSummaryAt(withSetsAt([5]), at(8)));
    const done = completeCurrentSet(resumed, at(50));
    assert.ok(done);
    assert.equal(sessionEndIso(done.session, at(90)), at(50));
  });
});
