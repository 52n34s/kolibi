import { useCallback } from 'react';

import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';
import { resolveActionAccess, type ProductAction } from '@/lib/product-access';
import { usePaywallRequestStore } from '@/stores/paywall-request-store';

/**
 * Checks a ProductAction before it starts (AGB Ziffer 10 Abs. 5). Resolves
 * true when the action may run; otherwise opens the paywall and resolves false.
 */
export function useRequirePlan() {
  const { isAnonymousUser, productAccessStatus, gatePremiumAccess } = useGatePremiumAccess();
  const requestPaywall = usePaywallRequestStore((s) => s.requestPaywall);

  return useCallback(
    async (action: ProductAction): Promise<boolean> => {
      const access = resolveActionAccess({
        status: productAccessStatus,
        isAnonymous: isAnonymousUser,
        action,
      });
      if (access === 'allowed') {
        return true;
      }
      if (access === 'loading' && (await gatePremiumAccess())) {
        return true;
      }
      requestPaywall({ withValuePitch: true });
      return false;
    },
    [gatePremiumAccess, isAnonymousUser, productAccessStatus, requestPaywall],
  );
}
