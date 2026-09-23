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
