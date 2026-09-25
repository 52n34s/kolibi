import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  clampFocusAreas,
  FOCUS_AREA_BOOST,
  FOCUS_AREA_IDS,
  FOCUS_AREA_MAX,
  FOCUS_AREA_TOPICS,
  focusAreaBoost,
} from './focus-areas.ts';

function loadLocale(lang: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
}

function lookup(tree: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node != null && typeof node === 'object') {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

describe('clampFocusAreas', () => {
  it('keeps the order it was given', () => {
    assert.deepEqual(clampFocusAreas(['more_fiber', 'more_protein']), ['more_fiber', 'more_protein']);
  });

  it('drops unknown ids', () => {
    assert.deepEqual(clampFocusAreas(['more_sleep', 'more_protein', '']), ['more_protein']);
  });

  it('drops duplicates', () => {
    assert.deepEqual(clampFocusAreas(['more_protein', 'more_protein', 'more_fiber']), [
      'more_protein',
      'more_fiber',
    ]);
  });

  it('stops at three', () => {
    const all = clampFocusAreas([...FOCUS_AREA_IDS]);
    assert.equal(all.length, FOCUS_AREA_MAX);
    assert.deepEqual(all, FOCUS_AREA_IDS.slice(0, FOCUS_AREA_MAX));
  });

  it('empty in, empty out', () => {
    assert.deepEqual(clampFocusAreas([]), []);
  });
});

describe('focusAreaBoost', () => {
  it('nothing chosen changes nothing', () => {
    assert.deepEqual(focusAreaBoost(null), {});
    assert.deepEqual(focusAreaBoost(undefined), {});
    assert.deepEqual(focusAreaBoost([]), {});
  });

  it('boosts the topics of the chosen area', () => {
    assert.deepEqual(focusAreaBoost(['more_fiber']), { fiber: -FOCUS_AREA_BOOST });
    assert.deepEqual(focusAreaBoost(['more_protein']), {
      protein: -FOCUS_AREA_BOOST,
      meal_distribution: -FOCUS_AREA_BOOST,
    });
  });

  it('covers every carbs topic for training energy', () => {
    const boost = focusAreaBoost(['more_training_energy']);
    for (const topic of ['carbs_training', 'carbs_around_training', 'carbs_before_training', 'carbs_on_run_days']) {
      assert.equal(boost[topic], -FOCUS_AREA_BOOST, topic);
    }
    assert.equal(boost.protein, undefined);
  });

  // Two areas pointing at the same kind must not push it twice as far up.
  it('an overlapping topic still moves by one step', () => {
    const boost = focusAreaBoost(['better_recovery', 'more_regular_meals']);
    assert.equal(boost.checkin, -FOCUS_AREA_BOOST);
  });

  it('only the first three areas count', () => {
    const boost = focusAreaBoost([...FOCUS_AREA_IDS]);
    assert.equal(boost.rest_day, undefined);
    assert.equal(boost.protein, -FOCUS_AREA_BOOST);
  });

  it('every boost is negative, so a boosted topic sorts before the rest', () => {
    for (const area of FOCUS_AREA_IDS) {
      for (const value of Object.values(focusAreaBoost([area]))) {
        assert.ok(value != null && value < 0);
      }
    }
  });
});

describe('focus area topics', () => {
  it('every area has at least one topic', () => {
    for (const area of FOCUS_AREA_IDS) {
      assert.ok(FOCUS_AREA_TOPICS[area].length > 0, area);
    }
  });
});

describe('i18n', () => {
  it('every area has a label in settings and goals, in de / en / es', () => {
    for (const lang of ['de', 'en', 'es']) {
      const tree = loadLocale(lang);
      for (const prefix of ['settings.focusAreas', 'goals.focusAreas']) {
        assert.equal(typeof lookup(tree, `${prefix}.title`), 'string', `${lang}: ${prefix}.title`);
        assert.equal(typeof lookup(tree, `${prefix}.subtitle`), 'string', `${lang}: ${prefix}.subtitle`);
        for (const area of FOCUS_AREA_IDS) {
          assert.equal(
            typeof lookup(tree, `${prefix}.label.${area}`),
            'string',
            `${lang}: ${prefix}.label.${area}`,
          );
        }
      }
      assert.equal(typeof lookup(tree, 'settings.focusAreas.max'), 'string', `${lang}: max hint`);
      assert.equal(
        typeof lookup(tree, 'today.focusAreasNudge.title'),
        'string',
        `${lang}: today.focusAreasNudge.title`,
      );
    }
  });
});
