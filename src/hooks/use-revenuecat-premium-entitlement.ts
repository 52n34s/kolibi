import { useEffect, useSyncExternalStore } from 'react';

import {
  getCustomerInfoSnapshot,
  getPremiumEntitlementExpirationDate,
  getPremiumEntitlementWillRenew,
  hasActivePremiumEntitlement,
  refreshRevenueCatCustomerInfo,
  subscribeToCustomerInfo,
} from '@/lib/revenuecat-customer-info';

export function useRevenueCatPremiumEntitlement() {
  const customerInfo = useSyncExternalStore(
    subscribeToCustomerInfo,
    getCustomerInfoSnapshot,
    getCustomerInfoSnapshot,
  );

  useEffect(() => {
    void refreshRevenueCatCustomerInfo();
  }, []);

  const isPremiumEntitlementActive = hasActivePremiumEntitlement(customerInfo);
  const entitlementExpirationDate = getPremiumEntitlementExpirationDate(customerInfo);
  const entitlementWillRenew = getPremiumEntitlementWillRenew(customerInfo);

  return {
    customerInfo,
    isPremiumEntitlementActive,
    entitlementExpirationDate,
    entitlementWillRenew,
  };
}
