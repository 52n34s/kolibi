import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const LANGS = ['de', 'en', 'es'] as const;
const NEGATION: Record<(typeof LANGS)[number], RegExp> = {
  de: /^(Noch kein|Noch nicht|Kein|Nichts)/,
  en: /^(No |Not |Nothing|None)/,
  es: /^(Aún no|Todavía no|No |Sin |Nada)/,
};
/** Empty states: what the user sees before there is anything to show. */
const EMPTY_KEYS = [
  'home.meals.emptyTitle',
  'history.calories.empty',
  'history.day.emptyMeals',
  'history.macro.empty',
  'history.summary.empty',
  'history.weight.empty',
  'supplements.emptyTitle',
  'supplements.reminders.empty',
  'training.panel.emptyTemplates',
  'training.plan.emptyTitle',
  'training.progress.empty',
  'training.catalog.empty',
  'home.calorieGoal.setAction',
  'home.weight.logAction',
  'home.mealItemRow.nutrientsEmpty',
  'home.foodSearch.noResultsHint',
];

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node != null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );
}

describe('empty states are worded positively', () => {
  for (const lang of LANGS) {
    it(lang, () => {
      const tree = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
      );
      for (const key of EMPTY_KEYS) {
        const text = lookup(tree, key);
        assert.equal(typeof text, 'string', `${lang} ${key} missing`);
        assert.doesNotMatch(text as string, NEGATION[lang], `${lang} ${key}: "${text}"`);
      }
    });
  }
});
