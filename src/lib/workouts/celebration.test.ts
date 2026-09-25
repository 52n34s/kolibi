import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildCelebration,
  CELEBRATION_LEVEL_KEY,
  CELEBRATION_MULTI_TITLE_KEY,
  type AcceptedLevelUp,
  type AcceptedPraise,
} from './celebration.ts';

function level(overrides: Partial<AcceptedLevelUp> = {}): AcceptedLevelUp {
  return { kind: 'variant_up', name: 'Klimmzüge', step: 3, total: 6, levelSticker: null, ...overrides };
}

function praise(overrides: Partial<AcceptedPraise> = {}): AcceptedPraise {
  return { kind: 'praise', name: 'Liegestütze', praiseKey: 'training.progression.praise.setsUp', ...overrides };
}

function loadLocale(lang: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
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

describe('buildCelebration', () => {
  it('nothing accepted → no celebration', () => {
    assert.equal(buildCelebration([]), null);
  });

  it('one level-up → the single level screen', () => {
    const sticker = { url: 'x' };
    assert.deepEqual(buildCelebration([level({ levelSticker: sticker })]), {
      mode: 'single_level',
      name: 'Klimmzüge',
      step: 3,
      total: 6,
      levelSticker: sticker,
    });
  });

  it('one level-up next to praise still leads with the level', () => {
    const result = buildCelebration([praise(), level()]);
    assert.equal(result?.mode, 'single_level');
  });

  it('several level-ups → one screen with the count and every level', () => {
    const result = buildCelebration([
      level({ name: 'Klimmzüge', step: 3, total: 6 }),
      level({ name: 'Dips', step: 2, total: 5, levelSticker: { url: 'y' } }),
    ]);
    assert.deepEqual(result, {
      mode: 'multi_level',
      count: 2,
      levels: [
        { name: 'Klimmzüge', step: 3, total: 6, levelSticker: null },
        { name: 'Dips', step: 2, total: 5, levelSticker: { url: 'y' } },
      ],
      praiseLine: null,
    });
  });

  it('keeps the accepted order of the levels', () => {
    const result = buildCelebration([level({ name: 'B' }), level({ name: 'A' }), level({ name: 'C' })]);
    assert.equal(result?.mode, 'multi_level');
    assert.deepEqual(
      result?.mode === 'multi_level' ? result.levels.map((item) => item.name) : [],
      ['B', 'A', 'C'],
    );
  });

  it('the first praise becomes the line under several levels', () => {
    const first = praise({ name: 'Liegestütze' });
    const result = buildCelebration([level(), first, praise({ name: 'Rudern' }), level({ name: 'Dips' })]);
    assert.equal(result?.mode, 'multi_level');
    assert.deepEqual(result?.mode === 'multi_level' ? result.praiseLine : null, first);
  });

  it('only praise → the praise screen, carrying its target', () => {
    const toTarget = { targetSets: 4, targetReps: 8, targetRepsMax: 12 };
    assert.deepEqual(buildCelebration([praise({ toTarget }), praise({ name: 'Rudern' })]), {
      mode: 'praise_only',
      name: 'Liegestütze',
      praiseKey: 'training.progression.praise.setsUp',
      toTarget,
    });
  });

  it('praise without a target stays without one', () => {
    assert.deepEqual(buildCelebration([praise()]), {
      mode: 'praise_only',
      name: 'Liegestütze',
      praiseKey: 'training.progression.praise.setsUp',
    });
  });
});

describe('i18n', () => {
  it('the multi title and the level line exist in de / en / es', () => {
    for (const lang of ['de', 'en', 'es']) {
      const tree = loadLocale(lang);
      const title = lookup(tree, CELEBRATION_MULTI_TITLE_KEY);
      assert.equal(typeof title, 'string', `${lang}: ${CELEBRATION_MULTI_TITLE_KEY}`);
      assert.ok(String(title).includes('{{count}}'), `${lang}: multiTitle needs {{count}}`);
      assert.equal(typeof lookup(tree, CELEBRATION_LEVEL_KEY), 'string', `${lang}: ${CELEBRATION_LEVEL_KEY}`);
    }
  });
});
