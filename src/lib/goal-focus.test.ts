import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { GOAL_FOCUS, goalFocusFor } from './goal-focus.ts';
import { resolvePostOnboardingWizard } from './plan-wizard.ts';
import { parseUsagePurpose, usesTraining } from './usage-purpose.ts';

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

describe('GOAL_FOCUS', () => {
  it('every goal includes protein', () => {
    for (const [category, entries] of Object.entries(GOAL_FOCUS)) {
      assert.ok(
        entries.some((entry) => entry.focus === 'protein'),
        `${category} lacks protein`,
      );
    }
  });

  it('reasons are specific to the goal', () => {
    for (const [category, entries] of Object.entries(GOAL_FOCUS)) {
      for (const entry of entries) {
        assert.equal(entry.reasonKey, `onboarding2.focus.reason.${category}.${entry.focus}`);
      }
    }
  });

  it('every label and reason exists in de, en and es', () => {
    for (const lang of ['de', 'en', 'es']) {
      const locale = loadLocale(lang);
      for (const entries of Object.values(GOAL_FOCUS)) {
        for (const entry of entries) {
          assert.equal(typeof lookup(locale, entry.labelKey), 'string', `${lang} ${entry.labelKey}`);
          assert.equal(typeof lookup(locale, entry.reasonKey), 'string', `${lang} ${entry.reasonKey}`);
        }
      }
    }
  });

  it('no category → no focus', () => {
    assert.deepEqual(goalFocusFor(null), []);
    assert.equal(goalFocusFor('lose')[0]?.focus, 'protein');
  });
});

describe('usage purpose and plan wizard hand-off', () => {
  it('parses stored values', () => {
    assert.equal(parseUsagePurpose('both'), 'both');
    assert.equal(parseUsagePurpose('gym'), null);
    assert.equal(usesTraining('training'), true);
    assert.equal(usesTraining('both'), true);
    assert.equal(usesTraining('nutrition'), false);
    assert.equal(usesTraining(null), false);
  });

  it('training or both opens the wizard right away when it exists', () => {
    for (const purpose of ['training', 'both'] as const) {
      assert.equal(
        resolvePostOnboardingWizard({ purpose, wizardAvailable: true, isReviewMode: false }),
        'open_now',
      );
      assert.equal(
        resolvePostOnboardingWizard({ purpose, wizardAvailable: false, isReviewMode: false }),
        'pending_training_tab',
      );
    }
  });

  it('nutrition or no answer waits for the training tab', () => {
    assert.equal(
      resolvePostOnboardingWizard({ purpose: 'nutrition', wizardAvailable: true, isReviewMode: false }),
      'pending_training_tab',
    );
    assert.equal(
      resolvePostOnboardingWizard({ purpose: null, wizardAvailable: true, isReviewMode: false }),
      'pending_training_tab',
    );
  });

  it('review mode leaves the wizard alone', () => {
    assert.equal(
      resolvePostOnboardingWizard({ purpose: 'both', wizardAvailable: true, isReviewMode: true }),
      'none',
    );
  });
});
