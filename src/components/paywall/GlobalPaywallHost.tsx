import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { useAuthStore } from '@/stores/auth-store';
import { usePaywallRequestStore } from '@/stores/paywall-request-store';

/** Renders the paywall requested through usePaywallRequestStore. */
export function GlobalPaywallHost() {
  const userId = useAuthStore((s) => s.session?.user?.id);
  const visible = usePaywallRequestStore((s) => s.visible);
  const withValuePitch = usePaywallRequestStore((s) => s.withValuePitch);
  const closePaywall = usePaywallRequestStore((s) => s.closePaywall);

  return (
    <PaywallSheet
      visible={visible}
      userId={userId}
      withValuePitch={withValuePitch}
      onClose={closePaywall}
    />
  );
}
