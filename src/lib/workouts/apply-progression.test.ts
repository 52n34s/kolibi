import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyProgression } from './apply-progression.ts';
import type { ProgressionSuggestion } from './progression.ts';
import type { ProgressionTarget } from './types.ts';

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

function suggestion(
  partial: Partial<ProgressionSuggestion> & Pick<ProgressionSuggestion, 'kind'>,
): ProgressionSuggestion {
  return {
    exerciseId: 'ex1',
    toExerciseId: null,
    fromTarget: target(),
    toTarget: target({ targetSets: 4 }),
    level: null,
    reasonKey: 'training.progression.reason.setsUp',
    reasonParams: {},
    ...partial,
  };
}

describe('applyProgression', () => {
  it('updates sets for sets_up on matching exercise', () => {
    const next = applyProgression(
      [
        {
          exerciseId: 'ex1',
          targetSets: 3,
          targetReps: 8,
          targetRepsMax: 12,
        },
        { exerciseId: 'ex2', targetSets: 3, targetReps: 10 },
      ],
      suggestion({ kind: 'sets_up' }),
    );
    assert.equal(next[0]!.targetSets, 4);
    assert.equal(next[1]!.targetSets, 3);
  });

  it('replaces exercise id on variant_up', () => {
    const next = applyProgression(
      [{ exerciseId: 'ex1', targetSets: 3, targetReps: 8, targetRepsMax: 12 }],
      suggestion({
        kind: 'variant_up',
        toExerciseId: 'ex2',
        toTarget: target({ targetReps: 5, targetRepsMax: 8 }),
      }),
    );
    assert.equal(next[0]!.exerciseId, 'ex2');
    assert.equal(next[0]!.targetReps, 5);
  });

  it('leaves targets unchanged on load_up', () => {
    const next = applyProgression(
      [{ exerciseId: 'ex1', targetSets: 3, targetReps: 10, targetRepsMax: 15 }],
      suggestion({
        kind: 'load_up',
        toTarget: target({ targetSets: 3, targetReps: 10, targetRepsMax: 15 }),
      }),
    );
    assert.equal(next[0]!.targetReps, 10);
    assert.equal(next[0]!.targetSets, 3);
  });
});
