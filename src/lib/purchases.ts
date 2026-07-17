import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';

export async function initPurchases(userId: string | null) {
  try {
    await Purchases.setLogLevel(LOG_LEVEL.WARN);
    await Purchases.configure({
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
      appUserID: userId ?? undefined,
    });
  } catch (error) {
    console.error('[RevenueCat] configure failed:', error);
  }
}

export async function logOutPurchases() {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('[RevenueCat] logOut failed:', error);
  }
}

export async function getDefaultMonthlyPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all.default ?? offerings.current;

    if (!offering) {
      return null;
    }

    return offering.monthly ?? offering.availablePackages[0] ?? null;
  } catch (error) {
    console.warn('[RevenueCat] getOfferings unavailable:', error);
    return null;
  }
}

export async function purchasePremiumPackage(packageToBuy: PurchasesPackage) {
  return Purchases.purchasePackage(packageToBuy);
}

export async function restorePremiumPurchases() {
  return Purchases.restorePurchases();
}

export async function getRevenueCatOriginalTransactionId(): Promise<string | null> {
  const metadata = await getRevenueCatSubscriptionMetadata();
  return metadata.rcOriginalTransactionId;
}

export async function getRevenueCatSubscriptionMetadata(): Promise<{
  rcOriginalTransactionId: string | null;
  productId: string | null;
}> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlements = Object.values(customerInfo.entitlements.active);

    for (const entitlement of entitlements) {
      const record = entitlement as {
        productIdentifier?: string | null;
        storeTransactionId?: string | null;
        originalTransactionIdentifier?: string | null;
      };

      const transactionId = record.originalTransactionIdentifier ?? record.storeTransactionId;
      const productId = record.productIdentifier ?? null;

      if (typeof transactionId === 'string' && transactionId.length > 0) {
        return {
          rcOriginalTransactionId: transactionId,
          productId: typeof productId === 'string' && productId.length > 0 ? productId : null,
        };
      }

      if (typeof productId === 'string' && productId.length > 0) {
        return {
          rcOriginalTransactionId: null,
          productId,
        };
      }
    }

    const activeProductId = customerInfo.activeSubscriptions[0] ?? null;

    return {
      rcOriginalTransactionId: null,
      productId: activeProductId,
    };
  } catch (error) {
    console.warn('[RevenueCat] getRevenueCatSubscriptionMetadata failed:', error);
    return {
      rcOriginalTransactionId: null,
      productId: null,
    };
  }
}
