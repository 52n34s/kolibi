import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  koliRouteAccess,
  resolveActionAccess,
  resolveProductAccessStatus,
} from '@/lib/product-access';

describe('resolveProductAccessStatus', () => {
  it('allows anonymous users regardless of entitlement or DB', () => {
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: true,
        isPremiumEntitlementActive: false,
        hasDbPremiumAccess: false,
      }),
      'allowed',
    );
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: true,
        isPremiumEntitlementActive: false,
        hasDbPremiumAccess: null,
      }),
      'allowed',
    );
  });

  it('allows registered users with an active RevenueCat entitlement', () => {
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: false,
        isPremiumEntitlementActive: true,
        hasDbPremiumAccess: false,
      }),
      'allowed',
    );
  });

  it('is loading for registered users while DB access is unknown', () => {
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: false,
        isPremiumEntitlementActive: false,
        hasDbPremiumAccess: null,
      }),
      'loading',
    );
  });

  it('locks registered users without entitlement or DB access', () => {
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: false,
        isPremiumEntitlementActive: false,
        hasDbPremiumAccess: false,
      }),
      'locked',
    );
  });

  it('allows registered users with DB premium override', () => {
    assert.equal(
      resolveProductAccessStatus({
        isAnonymous: false,
        isPremiumEntitlementActive: false,
        hasDbPremiumAccess: true,
      }),
      'allowed',
    );
  });
});

describe('resolveActionAccess (AGB Ziffer 10 Abs. 5)', () => {
  const actions = [
    'photoScan',
    'barcode',
    'manualMeal',
    'enterWeight',
    'startSession',
    'backfillSession',
    'editPlan',
    'editSession',
    'logTraining',
  ] as const;

  it('opens the paywall for every new entry and training action without a plan', () => {
    for (const action of actions) {
      assert.equal(
        resolveActionAccess({ status: 'locked', isAnonymous: false, action }),
        'paywall',
        action,
      );
    }
  });

  it('allows every action with a plan', () => {
    for (const action of actions) {
      assert.equal(
        resolveActionAccess({ status: 'allowed', isAnonymous: false, action }),
        'allowed',
        action,
      );
    }
  });

  it('waits while the plan check is running', () => {
    assert.equal(
      resolveActionAccess({ status: 'loading', isAnonymous: false, action: 'startSession' }),
      'loading',
    );
  });

  it('leaves anonymous users to their own scan limit and signup step', () => {
    for (const action of actions) {
      assert.equal(
        resolveActionAccess({ status: 'allowed', isAnonymous: true, action }),
        'allowed',
        action,
      );
    }
  });
});

describe('koliRouteAccess', () => {
  it('keeps history, session details, exercise progress and the export open', () => {
    for (const path of [
      '/koli/day/2026-09-20',
      '/koli/export',
      '/koli/workout-session/abc',
      '/koli/exercise-progress/push_up',
      '/koli/training-log',
    ]) {
      assert.equal(koliRouteAccess(path, undefined), 'open', path);
    }
  });

  it('keeps the settings hub open and the goals segment behind the plan', () => {
    assert.equal(koliRouteAccess('/koli', 'settings'), 'open');
    assert.equal(koliRouteAccess('/koli', undefined), 'needsPlan');
    assert.equal(koliRouteAccess('/koli', 'goals'), 'needsPlan');
  });

  it('needs a plan for editing the plan, backfilling and other entry screens', () => {
    for (const path of [
      '/koli/workout-plan',
      '/koli/workout-template-edit',
      '/koli/workout-backfill',
      '/koli/exercise-edit',
      '/koli/exercises',
      '/koli/supplements',
      '/koli/calorie-goal',
    ]) {
      assert.equal(koliRouteAccess(path, undefined), 'needsPlan', path);
    }
  });
});
