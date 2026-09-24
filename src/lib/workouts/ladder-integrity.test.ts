import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATALOG_LADDER_RUNGS,
  assertContiguousLadderSteps,
  catalogLadderEntriesFromRungs,
} from './ladder-integrity.ts';

describe('assertContiguousLadderSteps', () => {
  it('accepts ladders that start at 1 with no gaps or duplicates', () => {
    assert.doesNotThrow(() =>
      assertContiguousLadderSteps([
        { ladderKey: 'a', ladderStep: 1 },
        { ladderKey: 'a', ladderStep: 2 },
        { ladderKey: 'b', ladderStep: 1 },
      ]),
    );
  });

  it('rejects a gap (silent progression killer)', () => {
    assert.throws(
      () =>
        assertContiguousLadderSteps([
          { ladderKey: 'pull_vertical', ladderStep: 1, catalogSlug: 'dead_hang' },
          { ladderKey: 'pull_vertical', ladderStep: 3, catalogSlug: 'negative_pull_up' },
        ]),
      /contiguous steps 1\.\.2/,
    );
  });

  it('rejects a duplicate step', () => {
    assert.throws(
      () =>
        assertContiguousLadderSteps([
          { ladderKey: 'dip', ladderStep: 1, catalogSlug: 'a' },
          { ladderKey: 'dip', ladderStep: 1, catalogSlug: 'b' },
        ]),
      /duplicate ladder_step 1/,
    );
  });

  it('rejects a ladder that does not start at 1', () => {
    assert.throws(
      () =>
        assertContiguousLadderSteps([
          { ladderKey: 'hanging', ladderStep: 2 },
          { ladderKey: 'hanging', ladderStep: 3 },
        ]),
      /contiguous steps 1\.\.2/,
    );
  });
});

describe('CATALOG_LADDER_RUNGS (post beginner_ladder_steps)', () => {
  it('is contiguous for every ladder_key', () => {
    assert.doesNotThrow(() =>
      assertContiguousLadderSteps(catalogLadderEntriesFromRungs(CATALOG_LADDER_RUNGS)),
    );
  });

  it('places chin_up on pull_vertical between negative_pull_up and pull_up', () => {
    const rungs = CATALOG_LADDER_RUNGS.pull_vertical;
    assert.deepEqual(rungs, [
      'dead_hang',
      'active_hang',
      'negative_pull_up',
      'chin_up',
      'pull_up',
      'archer_pull_up',
    ]);
  });

  it('keeps elevated_hands_pike below pike and elevated_pike (feet) above', () => {
    assert.deepEqual(CATALOG_LADDER_RUNGS.push_vertical, [
      'elevated_hands_pike_push_up',
      'pike_push_up',
      'elevated_pike_push_up',
      'wall_handstand_push_up',
    ]);
  });
});
