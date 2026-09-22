import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  INTRO_ELIGIBLE,
  introFreeTrialDays,
  isEligibleForFreeIntro,
} from './paywall-intro.ts';

/** Mirrors INTRO_ELIGIBILITY_STATUS without importing react-native-purchases. */
const Eligibility = {
  UNKNOWN: 0,
  INELIGIBLE: 1,
  ELIGIBLE: INTRO_ELIGIBLE,
  NO_INTRO_OFFER_EXISTS: 3,
} as const;

describe('introFreeTrialDays', () => {
  it('counts day units', () => {
    assert.equal(
      introFreeTrialDays({
        price: 0,
        priceString: '0',
        cycles: 1,
        period: 'P3D',
        periodUnit: 'DAY',
        periodNumberOfUnits: 3,
      }),
      3,
    );
  });

  it('counts week units', () => {
    assert.equal(
      introFreeTrialDays({
        price: 0,
        priceString: '0',
        cycles: 1,
        period: 'P1W',
        periodUnit: 'WEEK',
        periodNumberOfUnits: 1,
      }),
      7,
    );
  });

  it('returns null for unknown units', () => {
    assert.equal(
      introFreeTrialDays({
        price: 0,
        priceString: '0',
        cycles: 1,
        period: 'P3H',
        periodUnit: 'HOUR',
        periodNumberOfUnits: 3,
      }),
      null,
    );
  });
});

describe('isEligibleForFreeIntro', () => {
  it('is true only for ELIGIBLE', () => {
    assert.equal(isEligibleForFreeIntro(Eligibility.ELIGIBLE), true);
    assert.equal(isEligibleForFreeIntro(Eligibility.INELIGIBLE), false);
    assert.equal(isEligibleForFreeIntro(Eligibility.UNKNOWN), false);
    assert.equal(isEligibleForFreeIntro(Eligibility.NO_INTRO_OFFER_EXISTS), false);
    assert.equal(isEligibleForFreeIntro(undefined), false);
  });
});
