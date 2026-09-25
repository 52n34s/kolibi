import { Href, router, useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';
import { koliRouteAccess } from '@/lib/product-access';
import { usePaywallRequestStore } from '@/stores/paywall-request-store';

type RegisteredPremiumRouteGateProps = {
  children: ReactNode;
};

/**
 * AGB Ziffer 10 Abs. 5 for /koli/*: routes that show data (history day,
 * session details, exercise progress, export) and the settings hub stay open
 * for everyone. Entry and plan screens need a plan: a registered user without
 * one gets the paywall over the screen they came from. Anonymous users pass.
 */
export function RegisteredPremiumRouteGate({ children }: RegisteredPremiumRouteGateProps) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const { isAnonymousUser, isRegisteredProductLocked, isProductAccessLoading } =
    useGatePremiumAccess();
  const requestPaywall = usePaywallRequestStore((s) => s.requestPaywall);

  const segmentParam = Array.isArray(params.segment) ? params.segment[0] : params.segment;
  const routeOpen = isAnonymousUser || koliRouteAccess(pathname, segmentParam) === 'open';
  const blocked = !routeOpen && isRegisteredProductLocked;

  useEffect(() => {
    if (!blocked) {
      return;
    }
    requestPaywall({ withValuePitch: true });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home' as Href);
    }
  }, [blocked, requestPaywall]);

  if (routeOpen || (!isProductAccessLoading && !isRegisteredProductLocked)) {
    return <>{children}</>;
  }

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#4F46E5" />
    </View>
  );
}
