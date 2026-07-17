import Purchases, { type CustomerInfo } from 'react-native-purchases';

/** RevenueCat entitlement identifier configured in the RC dashboard. */
export const REVENUECAT_PREMIUM_ENTITLEMENT = 'premium';

type CustomerInfoListener = () => void;

let customerInfoSnapshot: CustomerInfo | null = null;
const customerInfoListeners = new Set<CustomerInfoListener>();
let sdkUpdateListenerRegistered = false;

function emitCustomerInfoChange() {
  for (const listener of customerInfoListeners) {
    listener();
  }
}

function setCustomerInfoSnapshot(next: CustomerInfo | null) {
  customerInfoSnapshot = next;
  emitCustomerInfoChange();
}

function ensureSdkUpdateListener() {
  if (sdkUpdateListenerRegistered) {
    return;
  }

  sdkUpdateListenerRegistered = true;

  Purchases.addCustomerInfoUpdateListener((customerInfo) => {
    setCustomerInfoSnapshot(customerInfo);
  });
}

export function getCustomerInfoSnapshot(): CustomerInfo | null {
  return customerInfoSnapshot;
}

export function subscribeToCustomerInfo(listener: CustomerInfoListener): () => void {
  ensureSdkUpdateListener();
  customerInfoListeners.add(listener);

  return () => {
    customerInfoListeners.delete(listener);
  };
}

export async function refreshRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  ensureSdkUpdateListener();

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    setCustomerInfoSnapshot(customerInfo);
    return customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] getCustomerInfo failed:', error);
    return null;
  }
}

export function resetRevenueCatCustomerInfoStore() {
  setCustomerInfoSnapshot(null);
}

export function hasActivePremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  return customerInfo?.entitlements.active[REVENUECAT_PREMIUM_ENTITLEMENT] != null;
}

export function getPremiumEntitlementExpirationDate(
  customerInfo: CustomerInfo | null,
): string | null {
  const entitlement = customerInfo?.entitlements.active[REVENUECAT_PREMIUM_ENTITLEMENT];
  if (!entitlement?.expirationDate) {
    return null;
  }

  return entitlement.expirationDate;
}
