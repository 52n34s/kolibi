import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProgressionHistoryUnit, ProgressionSuggestion } from './progression.ts';
import {
  allowsLevelUp,
  gateSuggestionByReadiness,
  isClearSuccess,
  isNeutralReadiness,
  pickNextTemplateForReadiness,
  type ReadinessGate,
} from './progression-readiness.ts';
import type { TemplateExercise, WorkoutTemplate } from './types.ts';

const TODAY = '2026-09-22'; // Tuesday

function gate(partial: Partial<ReadinessGate>): ReadinessGate {
  return { level: 'normal', basis: 'checkin', signals: [], alternativeUnitId: null, ...partial };
}

function unit(partial: Partial<ProgressionHistoryUnit> = {}): ProgressionHistoryUnit {
  return {
    sessionId: 's1',
    intensity: 'normal',
    sets: [
      {
        reps: 12,
        seconds: null,
        secondsOtherSide: null,
        targetReps: 8,
        targetRepsMax: 12,
        targetSeconds: null,
        targetSecondsMax: null,
        done: true,
        rir: 0,
      },
    ],
    ...partial,
  };
}

function suggestion(kind: ProgressionSuggestion['kind']): ProgressionSuggestion {
  const target = {
    targetSets: 3,
    targetReps: 8,
    targetRepsMax: 12,
    targetSeconds: null,
    targetSecondsMax: null,
  };
  return {
    kind,
    exerciseId: 'e1',
    toExerciseId: null,
    fromTarget: target,
    toTarget: target,
    level: null,
    reasonKey: 'x',
    reasonParams: {},
  };
}

function exercises(sets: number): TemplateExercise[] {
  return [
    {
      id: `te-${sets}`,
      exerciseId: 'e',
      exercise: {} as TemplateExercise['exercise'],
      position: 0,
      targetSets: sets,
      targetReps: 8,
      targetRepsMax: 12,
      targetSeconds: null,
      targetSecondsMax: null,
      targetWeightKg: null,
      restSeconds: null,
    },
  ];
}

function template(id: string, position: number, sets: number, weekdays: number[] = []): WorkoutTemplate {
  return {
    id,
    name: id,
    shortLabel: id.slice(0, 1).toUpperCase(),
    colorKey: 'indigo',
    weekdays,
    position,
    archivedAt: null,
    exercises: exercises(sets),
  };
}

describe('isNeutralReadiness', () => {
  it('is neutral without readiness, without data, or data without signals', () => {
    assert.equal(isNeutralReadiness(null), true);
    assert.equal(isNeutralReadiness(gate({ basis: 'none' })), true);
    assert.equal(isNeutralReadiness(gate({ basis: 'data' })), true);
    assert.equal(isNeutralReadiness(gate({ basis: 'data', signals: ['highLoad'] })), false);
    assert.equal(isNeutralReadiness(gate({ basis: 'checkin' })), false);
  });
});

describe('isClearSuccess', () => {
  it('needs an easy session or 2+ reps in reserve', () => {
    assert.equal(isClearSuccess(unit()), false);
    assert.equal(isClearSuccess(unit({ intensity: 'easy' })), true);
    assert.equal(
      isClearSuccess(unit({ sets: [{ ...unit().sets[0]!, rir: 2 }] })),
      true,
    );
    assert.equal(isClearSuccess(null), false);
  });
});

describe('allowsLevelUp', () => {
  it('follows bereit / normal after clear success / schonen', () => {
    assert.equal(allowsLevelUp(gate({ level: 'ready' }), false), true);
    assert.equal(allowsLevelUp(gate({ level: 'normal' }), false), false);
    assert.equal(allowsLevelUp(gate({ level: 'normal' }), true), true);
    assert.equal(allowsLevelUp(gate({ level: 'gentle' }), true), false);
  });

  it('changes nothing without a readiness value', () => {
    assert.equal(allowsLevelUp(null, false), true);
    assert.equal(allowsLevelUp(gate({ basis: 'none', level: 'normal' }), false), true);
  });
});

describe('gateSuggestionByReadiness', () => {
  it('holds back level-ups on a gentle day', () => {
    assert.equal(
      gateSuggestionByReadiness(suggestion('variant_up'), gate({ level: 'gentle' }), unit()),
      null,
    );
    assert.equal(
      gateSuggestionByReadiness(suggestion('sets_up'), gate({ level: 'normal' }), unit()),
      null,
    );
  });

  it('keeps level-ups when ready or after a clear success', () => {
    const up = suggestion('range_up');
    assert.equal(gateSuggestionByReadiness(up, gate({ level: 'ready' }), unit()), up);
    assert.equal(
      gateSuggestionByReadiness(up, gate({ level: 'normal' }), unit({ intensity: 'easy' })),
      up,
    );
  });

  it('always lets steps down through', () => {
    const down = suggestion('variant_down');
    assert.equal(gateSuggestionByReadiness(down, gate({ level: 'gentle' }), unit()), down);
    assert.equal(gateSuggestionByReadiness(null, gate({ level: 'gentle' }), unit()), null);
  });
});

describe('pickNextTemplateForReadiness', () => {
  const push = template('push', 0, 12, [1]);
  const pull = template('pull', 1, 12, [2]);
  const mobility = template('mobility', 2, 6);

  it('keeps the plan when not gentle or neutral', () => {
    const pick = pickNextTemplateForReadiness([push, pull, mobility], [], TODAY, gate({ level: 'ready' }));
    assert.equal(pick.template?.id, 'pull');
    assert.equal(pick.adjustment, null);
    assert.equal(
      pickNextTemplateForReadiness([push, pull], [], TODAY, null).template?.id,
      'pull',
    );
  });

  it('takes the alternative from the readiness on a gentle day', () => {
    const pick = pickNextTemplateForReadiness(
      [push, pull, mobility],
      [],
      TODAY,
      gate({ level: 'gentle', alternativeUnitId: 'push' }),
    );
    assert.equal(pick.template?.id, 'push');
    assert.equal(pick.adjustment, 'alternative');
    assert.equal(pick.plannedTemplate?.id, 'pull');
  });

  it('falls back to a clearly lighter unit', () => {
    const pick = pickNextTemplateForReadiness([push, pull, mobility], [], TODAY, gate({ level: 'gentle' }));
    assert.equal(pick.template?.id, 'mobility');
    assert.equal(pick.adjustment, 'lighterUnit');
  });

  it('suggests a lighter variant of the same unit otherwise', () => {
    const pick = pickNextTemplateForReadiness([push, pull], [], TODAY, gate({ level: 'gentle' }));
    assert.equal(pick.template?.id, 'pull');
    assert.equal(pick.adjustment, 'lighterVariant');
    assert.equal(pick.plannedTemplate, null);
  });

  it('skips units already done today', () => {
    const pick = pickNextTemplateForReadiness(
      [push, pull, mobility],
      [
        {
          templateId: 'mobility',
          loggedOn: TODAY,
          startedAt: `${TODAY}T07:00:00.000Z`,
          finishedAt: `${TODAY}T07:30:00.000Z`,
        },
      ],
      TODAY,
      gate({ level: 'gentle' }),
    );
    assert.equal(pick.template?.id, 'pull');
    assert.equal(pick.adjustment, 'lighterVariant');
  });
});
