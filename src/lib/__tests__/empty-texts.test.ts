import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const LANGS = ['de', 'en', 'es'] as const;
// Not for error messages: those may state a problem plainly, as long as they
// stay friendly and give a next step (see the tone pass, week test 3).
const NEGATION: Record<(typeof LANGS)[number], RegExp> = {
  de: /^(Noch kein|Noch nicht|Kein|Nichts|Zu wenig|Zu viel|Nicht genug)/i,
  en: /^(No |Not |Nothing|None|Too little|Too few|Too much|Too many)/i,
  es: /^(Aún no|Todavía no|No |Sin |Nada|Demasiado poco|Demasiado poca|Demasiadas|Demasiados)/i,
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

/**
 * Status / summary copy that isn't an "empty state" but follows the same
 * rule: no negation up front (tone pass, week test 3 — settings.deload.inactive,
 * targetWeight's unset placeholder, the weekly calorie-balance summary).
 */
const NO_NEGATION_KEYS = [
  ...EMPTY_KEYS,
  'settings.deload.inactive',
  'settings.targetWeight.progressStartEmpty',
  // Pluralized (i18next _one/_other), not a single flat key.
  'history.balance.summary.calorieUndershoot_one',
  'history.balance.summary.calorieUndershoot_other',
];

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node != null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );
}

describe('empty states and status copy are worded positively', () => {
  for (const lang of LANGS) {
    it(lang, () => {
      const tree = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
      );
      for (const key of NO_NEGATION_KEYS) {
        const text = lookup(tree, key);
        assert.equal(typeof text, 'string', `${lang} ${key} missing`);
        assert.doesNotMatch(text as string, NEGATION[lang], `${lang} ${key}: "${text}"`);
      }
    });
  }
});
