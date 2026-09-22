/**
 * StoreKit / RevenueCat intro helpers without importing react-native-purchases
 * (keeps node:test runnable). Eligibility enum values match INTRO_ELIGIBILITY_STATUS.
 */
export const INTRO_ELIGIBLE = 2;

type IntroPriceLike = {
  price: number;
  cycles: number;
  periodUnit: string;
  periodNumberOfUnits: number;
};

type ProductWithIntro = {
  introPrice: IntroPriceLike | null;
};

/** Free StoreKit intro (price 0). Paid intros are ignored for the trial copy. */
export function getFreeIntroPrice(product: ProductWithIntro): IntroPriceLike | null {
  const intro = product.introPrice;
  if (!intro || intro.price > 0) {
    return null;
  }
  return intro;
}

/**
 * Only ELIGIBLE may promise a trial. INELIGIBLE / NO_INTRO / UNKNOWN → no claim
 * (introPrice alone is not enough — it still appears after the offer was used).
 */
export function isEligibleForFreeIntro(status: number | null | undefined): boolean {
  return status === INTRO_ELIGIBLE;
}

/** Total free intro length in whole days (e.g. 3 DAY → 3, 1 WEEK → 7). */
export function introFreeTrialDays(intro: IntroPriceLike): number | null {
  const units = intro.periodNumberOfUnits;
  if (!Number.isFinite(units) || units <= 0) {
    return null;
  }

  const unit = intro.periodUnit.toUpperCase();
  if (unit === 'DAY') {
    return units * intro.cycles;
  }
  if (unit === 'WEEK') {
    return units * 7 * intro.cycles;
  }
  if (unit === 'MONTH') {
    return units * 30 * intro.cycles;
  }
  if (unit === 'YEAR') {
    return units * 365 * intro.cycles;
  }
  return null;
}

export function planPeriodLabelKey(plan: { monthsCount: number }): string {
  if (plan.monthsCount === 3) {
    return 'paywall.periodQuarter';
  }
  if (plan.monthsCount === 12) {
    return 'paywall.periodYear';
  }
  return 'paywall.periodMonth';
}
