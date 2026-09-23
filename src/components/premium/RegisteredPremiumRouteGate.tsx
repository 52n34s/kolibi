import { Href, router, useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';

/** Account / legal / subscription surfaces that must stay reachable without entitlement. */
const SETTINGS_ALLOWLIST_SEGMENT = 'settings';

function isKoliIndexPath(pathname: string): boolean {
  return pathname === '/koli' || pathname === '/koli/';
}

type RegisteredPremiumRouteGateProps = {
  children: ReactNode;
};

/**
 * Blocks registered users without an active paid entitlement from premium /koli/* routes.
 * Anonymous users pass through (scan-limit / signup flow is separate).
 * The /koli index with ?segment=settings remains reachable for account management.
 */
export function RegisteredPremiumRouteGate({ children }: RegisteredPremiumRouteGateProps) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const {
    userId,
    isAnonymousUser,
    isRegisteredProductLocked,
    isProductAccessLoading,
    gatePremiumAccess,
  } = useGatePremiumAccess();

  const segmentParam = Array.isArray(params.segment) ? params.segment[0] : params.segment;
  const onKoliIndex = isKoliIndexPath(pathname);
  const onSettingsIndex = onKoliIndex && segmentParam === SETTINGS_ALLOWLIST_SEGMENT;

  const [showPaywall, setShowPaywall] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isAnonymousUser) {
        if (!cancelled) {
          setShowPaywall(false);
          setReady(true);
        }
        return;
      }

      // Settings hub must remain reachable (account, plan/restore, legal, deletion).
      if (onSettingsIndex) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      if (!isProductAccessLoading && !isRegisteredProductLocked) {
        if (!cancelled) {
          setShowPaywall(false);
          setReady(true);
        }
        return;
      }

      if (isProductAccessLoading) {
        if (!cancelled) {
          setReady(false);
        }
        return;
      }

      // Locked registered user on a premium route — redirect to settings + paywall.
      const hasAccess = await gatePremiumAccess();
      if (cancelled) {
        return;
      }

      if (hasAccess) {
        setShowPaywall(false);
        setReady(true);
        return;
      }

      setShowPaywall(true);
      router.replace('/koli?segment=settings' as Href);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    gatePremiumAccess,
    isAnonymousUser,
    isProductAccessLoading,
    isRegisteredProductLocked,
    onKoliIndex,
    onSettingsIndex,
    pathname,
  ]);

  const showChildren = ready && (isAnonymousUser || onSettingsIndex || !isRegisteredProductLocked);

  return (
    <>
      {showChildren ? (
        children
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4F46E5" />
        </View>
      )}
      <PaywallSheet
        visible={showPaywall}
        userId={userId}
        onClose={() => setShowPaywall(false)}
        withValuePitch
      />
    </>
  );
}
