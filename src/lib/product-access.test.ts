import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveProductAccessStatus } from '@/lib/product-access';

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
