import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  CATALOG_LADDER_RUNGS,
  assertContiguousLadderSteps,
  type LadderStepEntry,
} from './ladder-integrity.ts';
import {
  PLAN_CATALOG,
  getPlanCatalogEntry,
  hasPlanEquipment,
  planCatalogName,
  planLadder,
} from './plan-catalog.ts';

/** catalog-images.ts requires webp assets, so read its keys as text. */
const CATALOG_EXERCISE_IMAGES_SLUGS = [
  ...readFileSync(new URL('./catalog-images.ts', import.meta.url), 'utf8').matchAll(
    /^\s+([a-z_]+): require\(/gm,
  ),
].map((match) => match[1]!);

describe('PLAN_CATALOG snapshot', () => {
  it('has contiguous ladder steps per ladder', () => {
    const entries: LadderStepEntry[] = PLAN_CATALOG.filter(
      (entry) => entry.ladderKey != null && entry.ladderStep != null,
    ).map((entry) => ({
      ladderKey: entry.ladderKey!,
      ladderStep: entry.ladderStep!,
      catalogSlug: entry.slug,
    }));
    assert.doesNotThrow(() => assertContiguousLadderSteps(entries));
  });

  it('matches the expected ladder rungs after the beginner migration', () => {
    for (const [ladderKey, slugs] of Object.entries(CATALOG_LADDER_RUNGS)) {
      assert.deepEqual(
        planLadder(ladderKey).map((entry) => entry.slug),
        [...slugs],
        `ladder ${ladderKey}`,
      );
    }
    const snapshotLadders = new Set(
      PLAN_CATALOG.map((entry) => entry.ladderKey).filter((key) => key != null),
    );
    assert.deepEqual([...snapshotLadders].sort(), Object.keys(CATALOG_LADDER_RUNGS).sort());
  });

  it('has unique slugs, sane ranges and a bundled image for each', () => {
    const seen = new Set<string>();
    for (const entry of PLAN_CATALOG) {
      assert.equal(seen.has(entry.slug), false, `duplicate ${entry.slug}`);
      seen.add(entry.slug);
      assert.ok(entry.rangeMin >= 1 && entry.rangeMin <= entry.rangeMax, entry.slug);
      assert.ok(entry.defaultRestSeconds >= 30, entry.slug);
      assert.ok(CATALOG_EXERCISE_IMAGES_SLUGS.includes(entry.slug), `image ${entry.slug}`);
    }
  });

  it('resolves equipment any-of and localized names', () => {
    const row = getPlanCatalogEntry('inverted_row')!;
    assert.equal(hasPlanEquipment(row, []), false);
    assert.equal(hasPlanEquipment(row, ['rings']), true);
    assert.equal(hasPlanEquipment(getPlanCatalogEntry('push_up')!, []), true);
    assert.equal(planCatalogName(getPlanCatalogEntry('push_up')!, 'de-DE'), 'Liegestütze');
    assert.equal(planCatalogName(getPlanCatalogEntry('push_up')!, 'fr'), 'Push-ups');
  });
});
