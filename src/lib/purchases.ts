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
