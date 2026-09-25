import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isQualifyingUnit,
  setPerformanceValue,
  suggestProgression,
  type ProgressionHistorySet,
  type ProgressionHistoryUnit,
  type SuggestProgressionInput,
} from './progression.ts';
import type {
  Exercise,
  ProgressionEvent,
  ProgressionTarget,
} from './types.ts';

function exercise(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'kind'>): Exercise {
  return {
    userId: null,
    catalogSlug: partial.id,
    names: { de: partial.id },
    perSide: false,
    defaultSets: 3,
    defaultReps: 8,
    defaultRepsMax: 12,
    defaultSeconds: null,
    defaultSecondsMax: null,
    defaultRestSeconds: 90,
    imageAsset: null,
    imagePath: null,
    note: null,
    archivedAt: null,
    ladderKey: null,
    ladderStep: null,
    progressionKind: 'variant',
    timeCapSeconds: null,
    ...partial,
  };
}

function target(partial: Partial<ProgressionTarget> = {}): ProgressionTarget {
  return {
    targetSets: 3,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    ...partial,
  };
}

function set(
  partial: Partial<ProgressionHistorySet> & { done?: boolean } = {},
): ProgressionHistorySet {
  return {
    reps: 12,
    seconds: null,
    secondsOtherSide: null,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
    done: true,
    ...partial,
  };
}

function unit(
  partial: Partial<ProgressionHistoryUnit> & { sessionId: string },
): ProgressionHistoryUnit {
  return {
    intensity: 'normal',
    sets: [set(), set(), set()],
    ...partial,
  };
}

function event(partial: Partial<ProgressionEvent> & Pick<ProgressionEvent, 'id' | 'kind'>): ProgressionEvent {
  return {
    userId: 'u1',
    templateId: 't1',
    sessionId: null,
    fromExerciseId: 'ex1',
    toExerciseId: null,
    fromTarget: target(),
    toTarget: target(),
    status: 'accepted',
    createdAt: '2026-09-20T10:00:00.000Z',
    ...partial,
  };
}

function baseInput(
  partial: Partial<SuggestProgressionInput> & { exercise: Exercise },
): SuggestProgressionInput {
  return {
    ladder: [],
    currentTarget: target(),
    history: [],
    templateExerciseIds: [partial.exercise.id],
    lastEvents: [],
    ...partial,
  };
}

describe('setPerformanceValue', () => {
  it('uses min for perSide time', () => {
    const ex = exercise({ id: 'side', kind: 'time', perSide: true });
    assert.equal(
      setPerformanceValue(ex, set({ reps: null, seconds: 40, secondsOtherSide: 35 })),
      35,
    );
  });
});

describe('isQualifyingUnit', () => {
  it('requires snapshot targets to match currentTarget', () => {
    const current = target({ targetReps: 8, targetRepsMax: 12 });
    assert.equal(isQualifyingUnit(unit({ sessionId: 's1' }), current), true);
    assert.equal(
      isQualifyingUnit(
        unit({
          sessionId: 's2',
          sets: [set({ targetReps: 10, targetRepsMax: 12 })],
        }),
        current,
      ),
      false,
    );
  });
});

describe('suggestProgression', () => {
  it('a) returns null when progressionKind is none', () => {
    const ex = exercise({ id: 'ytw', kind: 'reps', progressionKind: 'none' });
    const suggestion = suggestProgression(
      baseInput({
        exercise: ex,
        history: [unit({ sessionId: 's1' })],
      }),
    );
    assert.equal(suggestion, null);
  });

  it('b) returns null when no qualifying unit', () => {
    const ex = exercise({ id: 'ex1', kind: 'reps' });
    const suggestion = suggestProgression(
      baseInput({
        exercise: ex,
        currentTarget: target({ targetReps: 8, targetRepsMax: 12 }),
        history: [
          unit({
            sessionId: 's1',
            sets: [set({ targetReps: 5, targetRepsMax: 8 }), set({ targetReps: 5, targetRepsMax: 8 })],
          }),
        ],
      }),
    );
    assert.equal(suggestion, null);
  });

  it('d/e) variant_up to next ladder step on success', () => {
    const step1 = exercise({
      id: 'incline',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 1,
      defaultReps: 8,
      defaultRepsMax: 15,
    });
    const step2 = exercise({
      id: 'push_up',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 2,
      defaultReps: 8,
      defaultRepsMax: 15,
    });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step1,
        ladder: [step1, step2],
        templateExerciseIds: [step1.id],
        history: [unit({ sessionId: 's1' })],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'variant_up');
    assert.equal(suggestion!.toExerciseId, step2.id);
    assert.equal(suggestion!.toTarget.targetReps, 8);
    assert.equal(suggestion!.toTarget.targetRepsMax, 15);
    assert.equal(suggestion!.toTarget.targetSets, 3);
    assert.deepEqual(suggestion!.level, {
      ladderKey: 'push_horizontal',
      fromStep: 1,
      toStep: 2,
      total: 2,
    });
  });

  it('e) sets_up when next variant already in template and sets < 5', () => {
    const step1 = exercise({
      id: 'incline',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 1,
    });
    const step2 = exercise({
      id: 'push_up',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 2,
    });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step1,
        ladder: [step1, step2],
        templateExerciseIds: [step1.id, step2.id],
        history: [unit({ sessionId: 's1' })],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'sets_up');
    assert.equal(suggestion!.toTarget.targetSets, 4);
  });

  it('e) range_up when sets already at max and no free next step', () => {
    const step1 = exercise({
      id: 'top',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 5,
    });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step1,
        ladder: [step1],
        currentTarget: target({ targetSets: 5, targetReps: 8, targetRepsMax: 12 }),
        templateExerciseIds: [step1.id],
        history: [
          unit({
            sessionId: 's1',
            sets: [set(), set(), set(), set(), set()],
          }),
        ],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'range_up');
    assert.equal(suggestion!.toTarget.targetReps, 10);
    assert.equal(suggestion!.toTarget.targetRepsMax, 14);
  });

  it('e) load_up keeps target and leaves toExerciseId null', () => {
    const ex = exercise({
      id: 'backpack',
      kind: 'reps',
      progressionKind: 'load',
      ladderKey: null,
      ladderStep: null,
    });
    const suggestion = suggestProgression(
      baseInput({
        exercise: ex,
        history: [unit({ sessionId: 's1' })],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'load_up');
    assert.equal(suggestion!.toExerciseId, null);
    assert.deepEqual(suggestion!.toTarget, target());
    assert.equal(suggestion!.reasonKey, 'training.progression.reason.loadUp');
  });

  it('d) hard intensity requires previous qualifying success', () => {
    const ex = exercise({
      id: 'incline',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 1,
    });
    const next = exercise({
      id: 'push_up',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 2,
    });
    const weak = unit({
      sessionId: 's0',
      intensity: 'normal',
      sets: [set({ reps: 6 }), set({ reps: 6 }), set({ reps: 6 })],
    });
    const hardOk = unit({ sessionId: 's1', intensity: 'hard' });
    const blocked = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [hardOk, weak],
      }),
    );
    assert.equal(blocked, null);

    const prevOk = unit({ sessionId: 's0', intensity: 'normal' });
    const allowed = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [hardOk, prevOk],
      }),
    );
    assert.equal(allowed?.kind, 'variant_up');
  });

  it('d) without upper bound requires lower + 2', () => {
    const ex = exercise({
      id: 'chin',
      kind: 'reps',
      progressionKind: 'variant',
      ladderKey: null,
      ladderStep: null,
    });
    const current = target({ targetReps: 8, targetRepsMax: null, targetSets: 3 });
    const matching = (reps: number) =>
      set({ reps, targetReps: 8, targetRepsMax: null });

    const fail = suggestProgression(
      baseInput({
        exercise: ex,
        currentTarget: current,
        history: [
          unit({
            sessionId: 's1',
            sets: [matching(9), matching(9), matching(9)],
          }),
        ],
      }),
    );
    assert.equal(fail, null);

    const ok = suggestProgression(
      baseInput({
        exercise: ex,
        currentTarget: current,
        history: [
          unit({
            sessionId: 's1',
            sets: [matching(10), matching(10), matching(10)],
          }),
        ],
      }),
    );
    assert.equal(ok?.kind, 'sets_up');
  });

  it('e) time_up when max + 5 stays within cap', () => {
    const ex = exercise({
      id: 'hollow',
      kind: 'time',
      progressionKind: 'variant',
      ladderKey: 'hollow',
      ladderStep: 2,
      defaultSeconds: 20,
      defaultSecondsMax: 30,
      timeCapSeconds: 60,
    });
    const current = target({
      targetSets: 2,
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: 20,
      targetSecondsMax: 30,
    });
    const timeSet = (seconds: number) =>
      set({
        reps: null,
        seconds,
        targetReps: null,
        targetRepsMax: null,
        targetSeconds: 20,
        targetSecondsMax: 30,
      });
    const suggestion = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex],
        currentTarget: current,
        history: [unit({ sessionId: 's1', sets: [timeSet(30), timeSet(30)] })],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'time_up');
    assert.equal(suggestion!.toTarget.targetSeconds, 25);
    assert.equal(suggestion!.toTarget.targetSecondsMax, 35);
  });

  it('e) time variant_up when at cap and next step free', () => {
    const step1 = exercise({
      id: 'tuck',
      kind: 'time',
      ladderKey: 'hollow',
      ladderStep: 1,
      defaultSeconds: 20,
      defaultSecondsMax: 40,
      timeCapSeconds: 60,
    });
    const step2 = exercise({
      id: 'hollow',
      kind: 'time',
      ladderKey: 'hollow',
      ladderStep: 2,
      defaultSeconds: 20,
      defaultSecondsMax: 30,
      timeCapSeconds: 60,
    });
    const current = target({
      targetSets: 2,
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: 40,
      targetSecondsMax: 60,
    });
    const timeSet = (seconds: number) =>
      set({
        reps: null,
        seconds,
        targetReps: null,
        targetRepsMax: null,
        targetSeconds: 40,
        targetSecondsMax: 60,
      });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step1,
        ladder: [step1, step2],
        currentTarget: current,
        templateExerciseIds: [step1.id],
        history: [unit({ sessionId: 's1', sets: [timeSet(60), timeSet(60)] })],
      }),
    );
    assert.equal(suggestion?.kind, 'variant_up');
    assert.equal(suggestion?.toExerciseId, step2.id);
    assert.equal(suggestion?.toTarget.targetSeconds, 20);
    assert.equal(suggestion?.toTarget.targetSecondsMax, 30);
  });

  it('f) variant_down after two weak qualifying units', () => {
    const step1 = exercise({
      id: 'bench',
      kind: 'reps',
      ladderKey: 'dip',
      ladderStep: 1,
      defaultReps: 8,
      defaultRepsMax: 12,
    });
    const step2 = exercise({
      id: 'parallel',
      kind: 'reps',
      ladderKey: 'dip',
      ladderStep: 2,
      defaultReps: 5,
      defaultRepsMax: 10,
    });
    const weak = (id: string) =>
      unit({
        sessionId: id,
        sets: [set({ reps: 4 }), set({ reps: 5 }), set({ reps: 12 })],
      });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step2,
        ladder: [step1, step2],
        templateExerciseIds: [step2.id],
        history: [weak('s1'), weak('s0')],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'variant_down');
    assert.equal(suggestion!.toExerciseId, step1.id);
    assert.equal(suggestion!.toTarget.targetReps, 8);
    assert.equal(suggestion!.toTarget.targetRepsMax, 12);
  });

  it('f) range_down when previous step already in template', () => {
    const step1 = exercise({
      id: 'bench',
      kind: 'reps',
      ladderKey: 'dip',
      ladderStep: 1,
    });
    const step2 = exercise({
      id: 'parallel',
      kind: 'reps',
      ladderKey: 'dip',
      ladderStep: 2,
    });
    const weak = (id: string) =>
      unit({
        sessionId: id,
        sets: [set({ reps: 4 }), set({ reps: 5 }), set({ reps: 12 })],
      });
    const suggestion = suggestProgression(
      baseInput({
        exercise: step2,
        ladder: [step1, step2],
        templateExerciseIds: [step1.id, step2.id],
        history: [weak('s1'), weak('s0')],
      }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion!.kind, 'range_down');
    assert.equal(suggestion!.toTarget.targetReps, 6);
    assert.equal(suggestion!.toTarget.targetRepsMax, 10);
  });

  it('g) suppresses declined kind until 2 qualifying sessions since', () => {
    const ex = exercise({
      id: 'incline',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 1,
    });
    const next = exercise({
      id: 'push_up',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 2,
    });
    const declined = event({
      id: 'ev1',
      kind: 'variant_up',
      status: 'declined',
      sessionId: 's-old',
    });

    const blocked = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [unit({ sessionId: 's1' })],
        lastEvents: [declined],
      }),
    );
    assert.equal(blocked, null);

    const allowed = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [unit({ sessionId: 's2' }), unit({ sessionId: 's1' }), unit({ sessionId: 's-old' })],
        lastEvents: [declined],
      }),
    );
    assert.equal(allowed?.kind, 'variant_up');
  });

  it('h) returns at most one suggestion', () => {
    const ex = exercise({
      id: 'incline',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 1,
    });
    const next = exercise({
      id: 'push_up',
      kind: 'reps',
      ladderKey: 'push_horizontal',
      ladderStep: 2,
    });
    const suggestion = suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [unit({ sessionId: 's1' })],
      }),
    );
    assert.ok(suggestion);
    assert.equal(typeof suggestion!.kind, 'string');
  });
});

describe('suggestProgression – reps in reserve (Block 2.5)', () => {
  const ex = exercise({ id: 'incline', kind: 'reps', ladderKey: 'push_horizontal', ladderStep: 1 });
  const next = exercise({ id: 'push_up', kind: 'reps', ladderKey: 'push_horizontal', ladderStep: 2 });
  const weakPrev = unit({
    sessionId: 's0',
    intensity: 'normal',
    sets: [set({ reps: 6 }), set({ reps: 6 }), set({ reps: 6 })],
  });
  const run = (latest: ProgressionHistoryUnit) =>
    suggestProgression(
      baseInput({
        exercise: ex,
        ladder: [ex, next],
        templateExerciseIds: [ex.id],
        history: [latest, weakPrev],
      }),
    );

  it('rir: upper bound everywhere + one set rir ≥ 2 → next step right away, even when hard', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'hard',
      sets: [set({ rir: 0 }), set({ rir: 2 }), set({ rir: 1 })],
    });
    assert.equal(run(latest)?.kind, 'variant_up');
  });

  it('rir: 3 ("3 or more") counts as clear reserve', () => {
    const latest = unit({ sessionId: 's1', intensity: 'hard', sets: [set(), set(), set({ rir: 3 })] });
    assert.equal(run(latest)?.kind, 'variant_up');
  });

  it('rir: 0 everywhere keeps the existing hard rule (waits for a second success)', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'hard',
      sets: [set({ rir: 0 }), set({ rir: 0 }), set({ rir: 0 })],
    });
    assert.equal(run(latest), null);
  });

  it('rir: missing keeps the existing hard rule', () => {
    const latest = unit({ sessionId: 's1', intensity: 'hard', sets: [set(), set(), set({ rir: null })] });
    assert.equal(run(latest), null);
  });

  it('rir: reserve without all sets at the upper bound is no success', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'normal',
      sets: [set({ reps: 10, rir: 3 }), set({ rir: 2 }), set({ rir: 2 })],
    });
    assert.equal(run(latest), null);
  });

  it('rir: open sets with rir do not count', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'hard',
      sets: [set(), set(), set(), set({ done: false, rir: 3 })],
    });
    assert.equal(run(latest), null);
  });
});

describe('suggestProgression – too hard twice (Block 2.5)', () => {
  const step1 = exercise({ id: 'bench', kind: 'reps', ladderKey: 'dip', ladderStep: 1 });
  const step2 = exercise({ id: 'parallel', kind: 'reps', ladderKey: 'dip', ladderStep: 2 });
  const one = unit({ sessionId: 's1', sets: [set({ reps: 5 }), set({ reps: 12 }), set({ reps: 12 })] });

  it('tooHardStreak: variant_down to the easier rung, reason rir.reasonTooHard', () => {
    const suggestion = suggestProgression(
      baseInput({
        exercise: step2,
        ladder: [step1, step2],
        templateExerciseIds: [step2.id],
        history: [one],
        tooHardStreak: true,
      }),
    );
    assert.equal(suggestion?.kind, 'variant_down');
    assert.equal(suggestion?.toExerciseId, step1.id);
    assert.equal(suggestion?.reasonKey, 'rir.reasonTooHard');
    assert.equal(suggestion?.level?.toStep, 1);
  });

  it('tooHardStreak: without an easier rung the existing rules apply', () => {
    const suggestion = suggestProgression(
      baseInput({
        exercise: step1,
        ladder: [step1, step2],
        templateExerciseIds: [step1.id],
        history: [one],
        tooHardStreak: true,
      }),
    );
    assert.equal(suggestion, null);
  });

  it('tooHardStreak: respects a fresh decline of variant_down', () => {
    const suggestion = suggestProgression(
      baseInput({
        exercise: step2,
        ladder: [step1, step2],
        templateExerciseIds: [step2.id],
        history: [one],
        tooHardStreak: true,
        lastEvents: [
          event({ id: 'e1', kind: 'variant_down', status: 'declined', sessionId: 's1' }),
        ],
      }),
    );
    assert.equal(suggestion, null);
  });
});

describe('suggestProgression – extra sets', () => {
  const ex = exercise({ id: 'incline', kind: 'reps', ladderKey: 'push_horizontal', ladderStep: 1 });
  const next = exercise({ id: 'push_up', kind: 'reps', ladderKey: 'push_horizontal', ladderStep: 2 });
  const weakPrev = unit({
    sessionId: 's0',
    intensity: 'normal',
    sets: [set({ reps: 6 }), set({ reps: 6 }), set({ reps: 6 })],
  });
  const run = (history: ProgressionHistoryUnit[], templateExerciseIds = [ex.id]) =>
    suggestProgression(
      baseInput({ exercise: ex, ladder: [ex, next], templateExerciseIds, history }),
    );

  it('planned sets decide: a weak extra set does not block the step up', () => {
    const latest = unit({
      sessionId: 's1',
      sets: [set(), set(), set(), set({ reps: 5 })],
    });
    assert.equal(run([latest, unit({ sessionId: 's0' })])?.kind, 'variant_up');
  });

  it('extra sets never cause a step down', () => {
    const tired = (id: string) =>
      unit({ sessionId: id, sets: [set({ reps: 9 }), set({ reps: 9 }), set({ reps: 9 }), set({ reps: 3 }), set({ reps: 3 }), set({ reps: 3 }), set({ reps: 3 })] });
    const suggestion = run([tired('s2'), tired('s1')]);
    assert.notEqual(suggestion?.kind, 'variant_down');
    assert.notEqual(suggestion?.kind, 'range_down');
  });

  it('an extra set at the upper bound is a clear success: "hart" does not wait', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'hard',
      sets: [set(), set(), set(), set({ reps: 12 })],
    });
    assert.equal(run([latest, weakPrev])?.kind, 'variant_up');
  });

  it('an extra set below the upper bound keeps the hard rule', () => {
    const latest = unit({
      sessionId: 's1',
      intensity: 'hard',
      sets: [set(), set(), set(), set({ reps: 10 })],
    });
    assert.equal(run([latest, weakPrev]), null);
  });

  it('sets_up after two sessions with more sets than planned', () => {
    const more = (id: string) =>
      unit({ sessionId: id, sets: [set({ reps: 9 }), set({ reps: 9 }), set({ reps: 9 }), set({ reps: 8 })] });
    const suggestion = run([more('s2'), more('s1')]);
    assert.equal(suggestion?.kind, 'sets_up');
    assert.equal(suggestion?.toTarget.targetSets, 4);
  });

  it('one session with an extra set is not enough for sets_up', () => {
    const more = unit({ sessionId: 's2', sets: [set({ reps: 9 }), set({ reps: 9 }), set({ reps: 9 }), set({ reps: 8 })] });
    const plain = unit({ sessionId: 's1', sets: [set({ reps: 9 }), set({ reps: 9 }), set({ reps: 9 })] });
    assert.equal(run([more, plain]), null);
  });

  it('no sets_up from extras at the sets cap', () => {
    const cap = target({ targetSets: 5 });
    const seven = (id: string) =>
      unit({ sessionId: id, sets: Array.from({ length: 6 }, () => set({ reps: 9 })) });
    const suggestion = suggestProgression(
      baseInput({ exercise: ex, ladder: [ex, next], currentTarget: cap, history: [seven('s2'), seven('s1')] }),
    );
    assert.equal(suggestion, null);
  });
});
