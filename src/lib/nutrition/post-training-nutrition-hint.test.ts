import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  POST_TRAINING_HINT_RULES,
  postTrainingNutritionHint,
  type PostTrainingNutritionHintContext,
  type PostTrainingNutritionHintLine,
} from './post-training-nutrition-hint.ts';

function ctx(
  overrides: Partial<PostTrainingNutritionHintContext> = {},
): PostTrainingNutritionHintContext {
  return {
    trainingKind: 'strength',
    consumed: { proteinG: 60, carbsG: 120, fatG: 40 },
    targets: { proteinG: 120, carbsG: 220, fatG: 70 },
    ...overrides,
  };
}

function kinds(lines: PostTrainingNutritionHintLine[]): string[] {
  return lines.map((line) => line.kind);
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

describe('postTrainingNutritionHint order', () => {
  it('leads with protein after strength', () => {
    assert.deepEqual(kinds(postTrainingNutritionHint(ctx())), ['protein', 'carbs']);
  });

  it('leads with carbs after endurance', () => {
    assert.deepEqual(kinds(postTrainingNutritionHint(ctx({ trainingKind: 'endurance' }))), [
      'carbs',
      'protein',
    ]);
  });

  it('never returns more than two macro lines', () => {
    const lines = postTrainingNutritionHint(ctx());
    assert.equal(lines.filter((line) => line.kind !== 'fat').length, 2);
  });
});

describe('postTrainingNutritionHint gaps', () => {
  it('reports the rounded grams to the day target', () => {
    const lines = postTrainingNutritionHint(
      ctx({
        consumed: { proteinG: 59.6, carbsG: 119.4, fatG: 0 },
        targets: { proteinG: 120, carbsG: 220, fatG: 70 },
      }),
    );
    assert.deepEqual(lines[0], {
      kind: 'protein',
      grams: 60,
      messageKey: 'postTraining.protein',
      params: { g: 60 },
    });
    assert.deepEqual(lines[1], {
      kind: 'carbs',
      grams: 101,
      messageKey: 'postTraining.carbs',
      params: { g: 101 },
    });
  });

  it('stays quiet below the thresholds', () => {
    const { minProteinG, minCarbsG } = POST_TRAINING_HINT_RULES;
    const lines = postTrainingNutritionHint(
      ctx({
        consumed: { proteinG: 120 - (minProteinG - 1), carbsG: 220 - (minCarbsG - 1), fatG: 0 },
      }),
    );
    assert.deepEqual(lines, []);
  });

  it('shows a line exactly at the threshold', () => {
    const { minProteinG, minCarbsG } = POST_TRAINING_HINT_RULES;
    const lines = postTrainingNutritionHint(
      ctx({ consumed: { proteinG: 120 - minProteinG, carbsG: 220 - minCarbsG, fatG: 0 } }),
    );
    assert.deepEqual(kinds(lines), ['protein', 'carbs']);
  });

  it('skips a macro that is already reached or over', () => {
    const lines = postTrainingNutritionHint(
      ctx({ consumed: { proteinG: 130, carbsG: 100, fatG: 0 } }),
    );
    assert.deepEqual(kinds(lines), ['carbs']);
  });

  it('unknown consumed or target means no line', () => {
    assert.deepEqual(
      postTrainingNutritionHint(ctx({ consumed: { proteinG: null, carbsG: null, fatG: null } })),
      [],
    );
    assert.deepEqual(
      postTrainingNutritionHint(ctx({ targets: { proteinG: null, carbsG: 0, fatG: null } })),
      [],
    );
  });

  it('ignores broken numbers instead of throwing', () => {
    assert.deepEqual(
      postTrainingNutritionHint(
        ctx({ consumed: { proteinG: Number.NaN, carbsG: -5, fatG: Number.NaN } }),
      ),
      [],
    );
  });
});

describe('postTrainingNutritionHint fat line', () => {
  it('comes on top once fat is at 85 % of the target', () => {
    const lines = postTrainingNutritionHint(
      ctx({ consumed: { proteinG: 60, carbsG: 120, fatG: 70 * POST_TRAINING_HINT_RULES.fatAlmostRatio } }),
    );
    assert.deepEqual(kinds(lines), ['protein', 'carbs', 'fat']);
    assert.deepEqual(lines[2], { kind: 'fat', messageKey: 'postTraining.fat' });
  });

  it('stays quiet just below the ratio', () => {
    const lines = postTrainingNutritionHint(ctx({ consumed: { proteinG: 60, carbsG: 120, fatG: 59 } }));
    assert.deepEqual(kinds(lines), ['protein', 'carbs']);
  });

  it('shows alone when both macros are done', () => {
    const lines = postTrainingNutritionHint(
      ctx({ consumed: { proteinG: 120, carbsG: 220, fatG: 65 } }),
    );
    assert.deepEqual(lines, [{ kind: 'fat', messageKey: 'postTraining.fat' }]);
  });

  it('needs a fat target', () => {
    const lines = postTrainingNutritionHint(
      ctx({ consumed: { proteinG: 120, carbsG: 220, fatG: 65 }, targets: { proteinG: 120, carbsG: 220, fatG: 0 } }),
    );
    assert.deepEqual(lines, []);
  });
});

describe('i18n', () => {
  it('every key the hint emits exists in de / en / es', () => {
    const keys = new Set<string>();
    for (const trainingKind of ['strength', 'endurance'] as const) {
      const lines = postTrainingNutritionHint(
        ctx({ trainingKind, consumed: { proteinG: 0, carbsG: 0, fatG: 70 } }),
      );
      for (const line of lines) {
        keys.add(line.messageKey);
      }
    }
    assert.deepEqual([...keys].sort(), [
      'postTraining.carbs',
      'postTraining.fat',
      'postTraining.protein',
    ]);
    for (const lang of ['de', 'en', 'es']) {
      const tree = loadLocale(lang);
      for (const key of keys) {
        assert.equal(typeof lookup(tree, key), 'string', `${lang}: ${key}`);
      }
      for (const key of ['postTraining.protein', 'postTraining.carbs']) {
        assert.ok(String(lookup(tree, key)).includes('{{g}}'), `${lang}: ${key} needs {{g}}`);
      }
    }
  });
});
