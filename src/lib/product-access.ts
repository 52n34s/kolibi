/**
 * Pure product-access resolution for registered vs anonymous users.
 * Anonymous users are never "locked" here — scan limits are separate.
 */
export type ProductAccessStatus = 'loading' | 'allowed' | 'locked';

export function resolveProductAccessStatus(params: {
  isAnonymous: boolean;
  isPremiumEntitlementActive: boolean;
  /** null while the DB override / subscription check is in flight */
  hasDbPremiumAccess: boolean | null;
}): ProductAccessStatus {
  if (params.isAnonymous) {
    return 'allowed';
  }

  if (params.isPremiumEntitlementActive) {
    return 'allowed';
  }

  if (params.hasDbPremiumAccess === null) {
    return 'loading';
  }

  return params.hasDbPremiumAccess ? 'allowed' : 'locked';
}

/**
 * AGB Ziffer 10 Abs. 5: without an active plan the account, the history and
 * the export stay open; new entries, training and the photo analysis need a
 * plan. Viewing is never gated here.
 */
export type ProductAction =
  | 'photoScan'
  | 'barcode'
  | 'manualMeal'
  | 'enterWeight'
  | 'startSession'
  | 'backfillSession'
  | 'editPlan';

export type ActionAccess = 'allowed' | 'paywall' | 'loading';

/**
 * Registered users without a plan get the paywall for every ProductAction.
 * Anonymous users pass: their photo scan limit and the signup step for
 * barcode and manual entry are handled where those actions start.
 */
export function resolveActionAccess(params: {
  status: ProductAccessStatus;
  isAnonymous: boolean;
  action: ProductAction;
}): ActionAccess {
  if (params.isAnonymous) {
    return 'allowed';
  }
  if (params.status === 'loading') {
    return 'loading';
  }
  return params.status === 'locked' ? 'paywall' : 'allowed';
}

/** /koli routes that only show data (plus the settings hub) stay open. */
const OPEN_KOLI_ROUTE_PATTERNS: RegExp[] = [
  /^\/koli\/day\/[^/]+\/?$/,
  /^\/koli\/export\/?$/,
  /^\/koli\/workout-session\/[^/]+\/?$/,
  /^\/koli\/exercise-progress\/[^/]+\/?$/,
];

export type KoliRouteAccess = 'open' | 'needsPlan';

export function koliRouteAccess(pathname: string, segment: string | undefined): KoliRouteAccess {
  if (pathname === '/koli' || pathname === '/koli/') {
    return segment === 'settings' ? 'open' : 'needsPlan';
  }
  return OPEN_KOLI_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname)) ? 'open' : 'needsPlan';
}
