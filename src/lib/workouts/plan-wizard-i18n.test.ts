import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { KOLIBI_TEMPLATE_PRESETS } from './kolibi-template-presets.ts';
import { PLAN_FOCUSES, buildPlan, type PlanDays } from './plan-builder.ts';

type Tree = { [key: string]: string | Tree };

const LOCALES = ['de', 'en', 'es'] as const;

function readLocale(lang: string): Tree {
  return JSON.parse(
    readFileSync(new URL(`../../i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Tree;
}

function flatKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatKeys(value, `${prefix}${key}.`),
  );
}

function lookup(tree: Tree, path: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of path.split('.')) {
    if (node == null || typeof node === 'string') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

describe('planWizard i18n', () => {
  const locales = Object.fromEntries(LOCALES.map((lang) => [lang, readLocale(lang)]));

  it('has the same planWizard keys in de, en and es', () => {
    const de = flatKeys(locales.de!.planWizard as Tree).sort();
    for (const lang of LOCALES) {
      assert.deepEqual(flatKeys(locales[lang]!.planWizard as Tree).sort(), de, lang);
    }
  });

  it('names every session and preset the builder can produce', () => {
    const keys = new Set<string>();
    for (const days of [2, 4, 5] as PlanDays[]) {
      for (const focus of PLAN_FOCUSES) {
        for (const scope of ['full', 'single'] as const) {
          const plan = buildPlan({
            goal: 'fitness',
            days,
            minutes: 30,
            equipment: [],
            assessment: { push: 1, pull: 1, legs: 1 },
            focus,
            cardio: 'none',
            scope,
          });
          for (const session of plan.sessions) {
            keys.add(session.nameKey);
            keys.add(session.shortLabelKey);
          }
        }
      }
    }
    for (const preset of KOLIBI_TEMPLATE_PRESETS) {
      keys.add(preset.titleKey);
      keys.add(preset.subtitleKey);
    }
    for (const lang of LOCALES) {
      for (const key of keys) {
        const value = lookup(locales[lang]!, key);
        assert.ok(value, `${lang}: ${key}`);
        if (key.includes('.sessionShort.')) {
          assert.ok(value.length >= 1 && value.length <= 2, `${lang}: ${key} fits short_label`);
        }
      }
    }
  });
});
