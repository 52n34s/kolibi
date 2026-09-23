import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import {
  resolveProductAccessStatus,
  type ProductAccessStatus,
} from '@/lib/product-access';
import { fetchHasPremiumAccess } from '@/lib/subscription';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Shared premium gate for registered (non-anonymous) users.
 * Anonymous users are never product-locked here — callers handle scan limits / signup.
 */
export function useGatePremiumAccess() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const isAnonymousUser = useAuthStore((s) => s.session?.user?.is_anonymous === true);
  const { isPremiumEntitlementActive } = useRevenueCatPremiumEntitlement();
  const [hasDbPremiumAccess, setHasDbPremiumAccess] = useState<boolean | null>(() => {
    if (isAnonymousUser || isPremiumEntitlementActive) {
      return true;
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;

    if (isAnonymousUser || isPremiumEntitlementActive) {
      setHasDbPremiumAccess(true);
      return;
    }

    if (!userId) {
      setHasDbPremiumAccess(false);
      return;
    }

    setHasDbPremiumAccess(null);

    void (async () => {
      try {
        const hasAccess = await queryClient.ensureQueryData({
          queryKey: ['has-premium-access', userId, false],
          queryFn: () => fetchHasPremiumAccess(userId),
          staleTime: 60 * 1000,
        });
        if (!cancelled) {
          setHasDbPremiumAccess(hasAccess === true);
        }
      } catch (gateError) {
        console.error('[premium-gate] access check failed:', gateError);
        if (!cancelled) {
          setHasDbPremiumAccess(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAnonymousUser, isPremiumEntitlementActive, queryClient, userId]);

  const productAccessStatus: ProductAccessStatus = resolveProductAccessStatus({
    isAnonymous: isAnonymousUser,
    isPremiumEntitlementActive,
    hasDbPremiumAccess,
  });

  const gatePremiumAccess = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    if (isAnonymousUser) {
      return true;
    }

    if (isPremiumEntitlementActive) {
      return true;
    }

    try {
      const hasAccess = await queryClient.ensureQueryData({
        queryKey: ['has-premium-access', userId, false],
        queryFn: () => fetchHasPremiumAccess(userId),
        staleTime: 60 * 1000,
      });
      const allowed = hasAccess === true;
      setHasDbPremiumAccess(allowed);
      return allowed;
    } catch (gateError) {
      console.error('[premium-gate] access check failed:', gateError);
      setHasDbPremiumAccess(false);
      return false;
    }
  }, [isAnonymousUser, isPremiumEntitlementActive, queryClient, userId]);

  return {
    userId,
    isAnonymousUser,
    isPremiumEntitlementActive,
    productAccessStatus,
    /** Registered user without paid entitlement — product surface must lock. */
    isRegisteredProductLocked: productAccessStatus === 'locked',
    isProductAccessLoading: productAccessStatus === 'loading',
    gatePremiumAccess,
  };
}
