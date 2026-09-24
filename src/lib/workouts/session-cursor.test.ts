import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addExerciseToSession,
  addSet,
  adjustCurrent,
  buildActiveSessionFromTemplate,
  completeCurrentSet,
  currentExerciseIsPerSide,
  defaultSetValue,
  editDoneSet,
  jumpTo,
  moveExercise,
  openExerciseNames,
  removeLastSet,
  removeOpenTrailingSet,
  setCurrent,
  setCurrentSides,
  skipExercise,
  toSessionSetUpsert,
} from './session-logic.ts';
import type { ActiveSession } from './types.ts';
import type { Exercise, TemplateExercise, WorkoutTemplate } from './types.ts';

function exercise(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'kind'>): Exercise {
  return {
    userId: null,
    catalogSlug: null,
    names: { de: partial.names?.de ?? partial.id, en: partial.id },
    perSide: false,
    defaultSets: 3,
    defaultReps: 10,
    defaultRepsMax: null,
    defaultSeconds: 30,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
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

function te(
  partial: Partial<TemplateExercise> & {
    exerciseId: string;
    exercise: Exercise;
    position: number;
  },
): TemplateExercise {
  return {
    id: `te-${partial.exerciseId}`,
    targetSets: 2,
    targetReps: partial.exercise.kind === 'time' ? null : 8,
    targetRepsMax: partial.exercise.kind === 'time' ? null : 12,
    targetSeconds: partial.exercise.kind === 'time' ? 20 : null,
    targetSecondsMax: partial.exercise.kind === 'time' ? 40 : null,
    targetWeightKg: null,
    restSeconds: 60,
    ...partial,
  };
}

function template(exercises: TemplateExercise[]): WorkoutTemplate {
  return {
    id: 'tmpl',
    name: 'Push',
    shortLabel: 'P',
    colorKey: 'indigo',
    weekdays: [1],
    position: 0,
    exercises,
  };
}

describe('session snapshot / Vorbelegung', () => {
  it('prefills sets with the lower-bound target (not max, not history)', () => {
    const session = buildActiveSessionFromTemplate(
      template([
        te({
          exerciseId: 'e1',
          position: 0,
          exercise: exercise({ id: 'e1', kind: 'reps' }),
          targetReps: 8,
          targetRepsMax: 12,
          targetSets: 3,
        }),
      ]),
      { loggedOn: '2026-09-22' },
    );
    assert.equal(session.phase, 'active');
    assert.equal(session.items[0]?.sets.length, 3);
    assert.equal(defaultSetValue(session.items[0]!), 8);
    for (const set of session.items[0]!.sets) {
      assert.equal(set.value, 8);
      assert.equal(set.done, false);
    }
  });

  it('marks perSide on the snapshot for hold-timer UI', () => {
    const session = buildActiveSessionFromTemplate(
      template([
        te({
          exerciseId: 'plank',
          position: 0,
          exercise: exercise({ id: 'plank', kind: 'time', perSide: true }),
          targetSets: 1,
          targetReps: null,
          targetSeconds: 30,
        }),
      ]),
      { loggedOn: '2026-09-22' },
    );
    assert.equal(session.items[0]?.perSide, true);
    assert.equal(currentExerciseIsPerSide(session), true);
  });

  it('setCurrentSides stores min as value and max as other side', () => {
    let session = buildActiveSessionFromTemplate(
      template([
        te({
          exerciseId: 'side',
          position: 0,
          exercise: exercise({ id: 'side', kind: 'time', perSide: true }),
          targetSets: 1,
          targetReps: null,
          targetSeconds: 30,
        }),
      ]),
      { loggedOn: '2026-09-22' },
    );
    session = setCurrentSides(session, 40, 25);
    assert.equal(session.items[0]?.sets[0]?.value, 25);
    assert.equal(session.items[0]?.sets[0]?.secondsOtherSide, 40);
  });
});

describe('cursor', () => {
  function twoExerciseSession() {
    return buildActiveSessionFromTemplate(
      template([
        te({
          exerciseId: 'a',
          position: 0,
          exercise: exercise({ id: 'a', kind: 'reps' }),
          targetSets: 2,
          restSeconds: 45,
        }),
        te({
          exerciseId: 'b',
          position: 1,
          exercise: exercise({ id: 'b', kind: 'reps' }),
          targetSets: 2,
          restSeconds: 90,
        }),
      ]),
      { loggedOn: '2026-09-22', startedAt: '2026-09-22T09:00:00.000Z' },
    );
  }

  it('advances to the next set, then the next exercise', () => {
    const first = completeCurrentSet(twoExerciseSession(), '2026-09-22T09:01:00.000Z');
    assert.ok(first);
    assert.equal(first.restSeconds, 45);
    assert.equal(first.isLastSet, false);
    assert.deepEqual(first.session.cursor, { exerciseIndex: 0, setIndex: 1 });

    const second = completeCurrentSet(first.session, '2026-09-22T09:02:00.000Z');
    assert.ok(second);
    assert.deepEqual(second.session.cursor, { exerciseIndex: 1, setIndex: 0 });
  });

  it('moves to summary on the last set', () => {
    let session = twoExerciseSession();
    for (let i = 0; i < 4; i += 1) {
      const result = completeCurrentSet(session, `2026-09-22T09:0${i}:00.000Z`);
      assert.ok(result);
      session = result.session;
      if (i < 3) {
        assert.equal(result.isLastSet, false);
        assert.equal(session.phase, 'active');
      } else {
        assert.equal(result.isLastSet, true);
        assert.equal(session.phase, 'summary');
      }
    }
    assert.equal(completeCurrentSet(session), null);
  });

  it('skipExercise jumps past the given exercise', () => {
    const session = skipExercise(twoExerciseSession(), 0);
    assert.deepEqual(session.cursor, { exerciseIndex: 1, setIndex: 0 });
  });

  it('moveExercise reorders and remaps cursor; done sets get new positions', () => {
    let session = twoExerciseSession();
    const done = completeCurrentSet(session, '2026-09-22T09:01:00.000Z');
    assert.ok(done);
    session = moveExercise(done.session, 0, 1);
    assert.equal(session.items[0]?.exerciseId, 'b');
    assert.equal(session.items[1]?.exerciseId, 'a');
    assert.deepEqual(session.cursor, { exerciseIndex: 1, setIndex: 1 });
    const upsert = toSessionSetUpsert(session, 1, 0);
    assert.equal(upsert?.exercisePosition, 1);
  });

  it('jumpTo and editDoneSet update values including otherSide', () => {
    let session = twoExerciseSession();
    const done = completeCurrentSet(session, '2026-09-22T09:01:00.000Z');
    assert.ok(done);
    session = editDoneSet(done.session, 0, 0, 15, 20);
    assert.equal(session.items[0]?.sets[0]?.value, 15);
    assert.equal(session.items[0]?.sets[0]?.secondsOtherSide, 20);
    session = jumpTo(session, 1, 0);
    assert.deepEqual(session.cursor, { exerciseIndex: 1, setIndex: 0 });
    assert.equal(session.phase, 'active');
  });

  it('adjustCurrent / setCurrent clamp at 0', () => {
    let session = twoExerciseSession();
    session = setCurrent(session, 5);
    session = adjustCurrent(session, -10);
    assert.equal(session.items[0]?.sets[0]?.value, 0);
  });

  it('addSet / removeLastSet; done last set returns deletedSetId', () => {
    let session = twoExerciseSession();
    session = addSet(session, 0);
    assert.equal(session.items[0]?.sets.length, 3);

    const undone = removeLastSet(session, 0);
    assert.equal(undone.deletedSetId, null);
    assert.equal(undone.session.items[0]?.sets.length, 2);

    const done = completeCurrentSet(undone.session, '2026-09-22T09:01:00.000Z');
    assert.ok(done);
    // complete set 0; set 1 still open — remove last (open) → no delete
    const removedOpen = removeLastSet(done.session, 0);
    assert.equal(removedOpen.deletedSetId, null);
    assert.equal(removedOpen.session.items[0]?.sets.length, 1);

    // only done set left — cannot remove (length <= 1)
    const blocked = removeLastSet(removedOpen.session, 0);
    assert.equal(blocked.deletedSetId, null);
    assert.equal(blocked.session.items[0]?.sets.length, 1);

    // two done sets: complete another after add
    let s = twoExerciseSession();
    const d1 = completeCurrentSet(s, '2026-09-22T09:01:00.000Z');
    assert.ok(d1);
    const d2 = completeCurrentSet(d1.session, '2026-09-22T09:02:00.000Z');
    assert.ok(d2);
    const removedDone = removeLastSet(d2.session, 0);
    assert.ok(removedDone.deletedSetId);
    assert.equal(removedDone.session.items[0]?.sets.length, 1);
  });

  it('addSet appends a chip set prefilled with the lower-bound target', () => {
    let session = twoExerciseSession();
    assert.equal(session.items[0]?.sets.length, 2);
    assert.equal(session.items[0]?.targetReps, 8);

    session = addSet(session, 0);
    const added = session.items[0]?.sets[2];
    assert.ok(added);
    assert.equal(added.done, false);
    assert.equal(added.value, 8);
    assert.equal(session.items[0]?.sets.length, 3);
  });

  it('removeOpenTrailingSet only drops an open last set when more than one exists', () => {
    let session = addSet(twoExerciseSession(), 0);
    assert.equal(session.items[0]?.sets.length, 3);

    // Long-press on a done chip → no-op
    const afterDone = completeCurrentSet(session, '2026-09-22T09:01:00.000Z');
    assert.ok(afterDone);
    const noopDone = removeOpenTrailingSet(afterDone.session, 0, 0);
    assert.equal(noopDone.removed, false);
    assert.equal(noopDone.session.items[0]?.sets.length, 3);

    // Long-press on a non-trailing open set → no-op
    const noopMiddle = removeOpenTrailingSet(afterDone.session, 0, 1);
    assert.equal(noopMiddle.removed, false);

    // Trailing open set with length > 1 → removed, no server delete id
    const removed = removeOpenTrailingSet(afterDone.session, 0, 2);
    assert.equal(removed.removed, true);
    assert.equal(removed.session.items[0]?.sets.length, 2);

    // Sole remaining set (even if open) → no-op
    let sole = twoExerciseSession();
    sole = removeLastSet(sole, 0).session;
    assert.equal(sole.items[0]?.sets.length, 1);
    assert.equal(sole.items[0]?.sets[0]?.done, false);
    const noopSole = removeOpenTrailingSet(sole, 0, 0);
    assert.equal(noopSole.removed, false);
    assert.equal(noopSole.session.items[0]?.sets.length, 1);
  });

  it('addExerciseToSession appends with addedInSession', () => {
    let session = twoExerciseSession();
    session = addExerciseToSession(
      session,
      exercise({ id: 'extra', kind: 'reps', names: { de: 'Extra', en: 'Extra' } }),
    );
    assert.equal(session.items.length, 3);
    assert.equal(session.items[2]?.addedInSession, true);
    assert.equal(session.items[2]?.name, 'Extra');
  });
});

function threeExercises(): ActiveSession {
  const session = buildActiveSessionFromTemplate(
    {
      id: 't1',
      name: 'Push',
      shortLabel: 'Ps',
      colorKey: 'teal',
      weekdays: [],
      position: 0,
      exercises: [0, 1, 2].map((position) => ({
        id: `te-${position}`,
        templateId: 't1',
        exerciseId: `ex-${position}`,
        position,
        targetSets: 2,
        targetReps: 8,
        targetRepsMax: null,
        targetSeconds: null,
        targetSecondsMax: null,
        targetWeightKg: null,
        restSeconds: null,
        exercise: {
          id: `ex-${position}`,
          userId: null,
          catalogSlug: `slug-${position}`,
          names: { de: `Übung ${position}` },
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
        },
      })),
    } as never,
    { userId: 'user-a', loggedOn: '2026-09-22' },
  );
  return session;
}

describe('skipExercise', () => {

  it('marks the exercise and moves the cursor past it', () => {
    const next = skipExercise(threeExercises(), 0);
    assert.equal(next.items[0]?.skipped, true);
    assert.deepEqual(next.cursor, { exerciseIndex: 1, setIndex: 0 });
  });

  it('does not come back on its own after the next exercise is done', () => {
    let session = skipExercise(threeExercises(), 0);
    // finish exercise 1 completely
    session = completeCurrentSet(session)!.session;
    session = completeCurrentSet(session)!.session;
    assert.equal(session.cursor.exerciseIndex, 2, 'goes on to 2, never back to the skipped 0');
  });

  it('ends the session when only skipped exercises are left', () => {
    let session = threeExercises();
    session = skipExercise(session, 1);
    session = skipExercise(session, 2);
    session = completeCurrentSet(session)!.session;
    session = completeCurrentSet(session)!.session;
    assert.equal(session.phase, 'summary');
  });

  it('jumping back from the overview un-skips it', () => {
    const skipped = skipExercise(threeExercises(), 0);
    const back = jumpTo(skipped, 0, 0);
    assert.equal(back.items[0]?.skipped, false);
    assert.deepEqual(back.cursor, { exerciseIndex: 0, setIndex: 0 });
    assert.equal(back.phase, 'active');
  });
});

describe('addExerciseToSession', () => {
  const catalogExercise = {
    id: 'ex-new',
    userId: null,
    catalogSlug: 'pike_push_up',
    names: { de: 'Pike Push-ups' },
    kind: 'reps' as const,
    perSide: false,
    defaultSets: 3,
    defaultReps: 6,
    defaultRepsMax: null,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'none' as const,
    timeCapSeconds: null,
  };

  it('appends the exercise and moves the cursor onto it', () => {
    const before = threeExercises();
    assert.equal(before.items.length, 3);

    const after = addExerciseToSession(before, catalogExercise as never);

    assert.equal(after.items.length, 4);
    assert.equal(after.items[3]?.name, 'Pike Push-ups');
    assert.equal(after.items[3]?.addedInSession, true);
    // The header reads "Übung {cursor+1}/{items.length}" — here: 4/4.
    assert.deepEqual(after.cursor, { exerciseIndex: 3, setIndex: 0 });
    assert.equal(after.cursor.exerciseIndex + 1, after.items.length);
  });

  it('re-opens a session that had already reached the summary', () => {
    const summary: ActiveSession = { ...threeExercises(), phase: 'summary' };
    const after = addExerciseToSession(summary, catalogExercise as never);
    assert.equal(after.phase, 'active');
    assert.equal(after.cursor.exerciseIndex, 3);
  });

  it('builds the sets from the catalog defaults', () => {
    const after = addExerciseToSession(threeExercises(), catalogExercise as never);
    assert.equal(after.items[3]?.sets.length, 3);
    assert.equal(after.items[3]?.sets[0]?.value, 6);
    assert.equal(after.items[3]?.sets.every((set) => !set.done), true);
  });
});

describe('open exercises at the end of a session', () => {
  /** Jumping ahead used to end the session with earlier exercises untouched. */
  it('wraps to the first open exercise instead of going to the summary', () => {
    let session = threeExercises();
    // Skip ahead to the last exercise, as the overview lets you.
    session = jumpTo(session, 2, 0);
    session = completeCurrentSet(session)!.session;
    const result = completeCurrentSet(session)!;

    assert.equal(result.isLastSet, false);
    assert.equal(result.session.phase, 'active');
    assert.deepEqual(result.session.cursor, { exerciseIndex: 0, setIndex: 0 });
  });

  it('only reaches the summary once nothing open is left', () => {
    let session = threeExercises();
    for (let i = 0; i < 6; i += 1) {
      const step = completeCurrentSet(session);
      assert.ok(step, `set ${i} should complete`);
      session = step!.session;
    }
    assert.equal(session.phase, 'summary');
  });

  it('treats skipped exercises as not open for the cursor', () => {
    let session = skipExercise(threeExercises(), 0);
    session = completeCurrentSet(session)!.session;
    session = completeCurrentSet(session)!.session;
    session = completeCurrentSet(session)!.session;
    const last = completeCurrentSet(session)!;
    assert.equal(last.session.phase, 'summary');
  });

  it('lists what is still open, skipped included', () => {
    const session = skipExercise(threeExercises(), 1);
    const open = openExerciseNames(session);
    assert.equal(open.length, 3);
    assert.ok(open.includes('Übung 1'));
  });
});
