import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatNextLevelHint, nextLevelHint } from './next-level-hint.ts';
import type { ActiveSet } from './types.ts';

let setId = 0;
const set = (value: number, done = true, secondsOtherSide: number | null = null): ActiveSet => ({
  id: `s${(setId += 1)}`,
  value,
  done,
  completedAt: done ? '2026-09-25T18:00:00Z' : null,
  secondsOtherSide,
});

const reps = (sets: ActiveSet[], repsMax: number | null = 12) => ({
  kind: 'reps' as const,
  perSide: false,
  targetSets: 3,
  targetReps: 8,
  targetRepsMax: repsMax,
  targetSeconds: null,
  targetSecondsMax: null,
  sets,
});

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

describe('nextLevelHint', () => {
  it('range 8–12: the upper bound in all planned sets', () => {
    assert.deepEqual(nextLevelHint(reps([set(10), set(8, false), set(8, false)]), { onLadder: false }), {
      kind: 'target',
      value: 12,
      sets: 3,
      unit: 'reps',
      perSide: false,
    });
  });

  it('all planned sets at the upper bound: goal reached, an extra set does not matter', () => {
    const item = reps([set(12), set(12), set(13), set(6)]);
    assert.deepEqual(nextLevelHint(item, { onLadder: false }), { kind: 'reached' });
  });

  it('a planned set below the upper bound keeps the target', () => {
    assert.equal(nextLevelHint(reps([set(12), set(11), set(12)]), { onLadder: false })?.kind, 'target');
  });

  it('fixed target without a range: nothing off a ladder, lower + 2 on a ladder', () => {
    assert.equal(nextLevelHint(reps([set(8)], null), { onLadder: false }), null);
    assert.equal(nextLevelHint(reps([set(8)], 8), { onLadder: false }), null);
    const hint = nextLevelHint(reps([set(8)], null), { onLadder: true });
    assert.equal(hint?.kind === 'target' ? hint.value : null, 10);
  });

  it('time per side: seconds, the weaker side counts', () => {
    const plank = {
      kind: 'time' as const,
      perSide: true,
      targetSets: 2,
      targetReps: null,
      targetRepsMax: null,
      targetSeconds: 20,
      targetSecondsMax: 40,
    };
    assert.deepEqual(nextLevelHint({ ...plank, sets: [set(40, true, 35), set(0, false)] }, { onLadder: false }), {
      kind: 'target',
      value: 40,
      sets: 2,
      unit: 'seconds',
      perSide: true,
    });
    assert.deepEqual(
      nextLevelHint({ ...plank, sets: [set(42, true, 40), set(40, true, 41)] }, { onLadder: false }),
      { kind: 'reached' },
    );
  });
});

describe('formatNextLevelHint', () => {
  it('reps, seconds and per side', () => {
    assert.equal(
      formatNextLevelHint({ kind: 'target', value: 12, sets: 3, unit: 'reps', perSide: false }, t),
      'training.panel.nextLevel.target {"max":"12","count":3}',
    );
    assert.equal(
      formatNextLevelHint({ kind: 'target', value: 40, sets: 2, unit: 'seconds', perSide: true }, t),
      'training.panel.nextLevel.target {"max":"40 s training.timer.perSide","count":2}',
    );
    assert.equal(formatNextLevelHint({ kind: 'reached' }, t), 'training.panel.nextLevel.reached');
  });
});
