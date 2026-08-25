import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type PurchasesPackage,
} from 'react-native-purchases';

let configurePromise: Promise<void> | null = null;
let identifiedUserId: string | null = null;
let identifyPromise: Promise<void> | null = null;

function isRevenueCatSandboxNoise(message: string): boolean {
  return (
    /syncing subscriber attributes/i.test(message) ||
    /BackendError(?:\s+error)?\s*0\b/i.test(message)
  );
}

function installRevenueCatLogHandler() {
  Purchases.setLogHandler((logLevel, message) => {
    if (isRevenueCatSandboxNoise(message)) {
      // Sandbox churn — keep visible in console without tripping LogBox.
      console.warn(`[RevenueCat] ${message}`);
      return;
    }

    switch (logLevel) {
      case LOG_LEVEL.VERBOSE:
      case LOG_LEVEL.DEBUG:
        if (__DEV__) {
          console.log(`[RevenueCat] ${message}`);
        }
        break;
      case LOG_LEVEL.INFO:
        console.log(`[RevenueCat] ${message}`);
        break;
      case LOG_LEVEL.WARN:
        console.warn(`[RevenueCat] ${message}`);
        break;
      case LOG_LEVEL.ERROR:
      default:
        console.error(`[RevenueCat] ${message}`);
        break;
    }
  });
}

/**
 * Configure RevenueCat exactly once at app start (anonymous until logIn).
 * Subsequent calls reuse the same configure promise.
 */
export async function configurePurchasesOnce(): Promise<void> {
  if (configurePromise) {
    return configurePromise;
  }

  configurePromise = (async () => {
    try {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
      installRevenueCatLogHandler();
      await Purchases.configure({
        apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!,
      });
    } catch (error) {
      configurePromise = null;
      console.error('[RevenueCat] configure failed:', error);
      throw error;
    }
  })();

  return configurePromise;
}

/**
 * Bind the SDK to the authenticated Supabase user via logIn.
 * Must complete before any purchase so the webhook receives a real app_user_id.
 */
export async function logInPurchases(userId: string): Promise<void> {
  await configurePurchasesOnce();

  if (identifiedUserId === userId) {
    return;
  }

  if (identifyPromise) {
    await identifyPromise;
    if (identifiedUserId === userId) {
      return;
    }
  }

  identifyPromise = (async () => {
    try {
      await Purchases.logIn(userId);
      identifiedUserId = userId;
    } catch (error) {
      console.error('[RevenueCat] logIn failed:', error);
      throw error;
    } finally {
      identifyPromise = null;
    }
  })();

  return identifyPromise;
}

/** Ensure configure + logIn finished for this user before offerings/purchase/restore. */
export async function ensurePurchasesIdentified(userId: string): Promise<void> {
  await logInPurchases(userId);
}

export async function logOutPurchases() {
  try {
    if (!configurePromise) {
      identifiedUserId = null;
      return;
    }

    await configurePromise;

    // logOut() throws when the SDK user is still anonymous (configure without logIn).
    if (await Purchases.isAnonymous()) {
      identifiedUserId = null;
      return;
    }

    await Purchases.logOut();
  } catch (error) {
    console.error('[RevenueCat] logOut failed:', error);
  } finally {
    identifiedUserId = null;
  }
}

export type DefaultOfferingPlanPackageType =
  | PACKAGE_TYPE.MONTHLY
  | PACKAGE_TYPE.THREE_MONTH
  | PACKAGE_TYPE.ANNUAL;

export type DefaultOfferingPlan = {
  packageType: DefaultOfferingPlanPackageType;
  monthsCount: 1 | 3 | 12;
  pkg: PurchasesPackage;
};

const DEFAULT_OFFERING_PLAN_ORDER: ReadonlyArray<{
  packageType: DefaultOfferingPlanPackageType;
  monthsCount: 1 | 3 | 12;
}> = [
  { packageType: PACKAGE_TYPE.MONTHLY, monthsCount: 1 },
  { packageType: PACKAGE_TYPE.THREE_MONTH, monthsCount: 3 },
  { packageType: PACKAGE_TYPE.ANNUAL, monthsCount: 12 },
];

/** Load default offering plans from availablePackages (monthly → 3-month → annual). */
export async function getDefaultOfferingPlans(): Promise<DefaultOfferingPlan[]> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all.default ?? offerings.current;

    if (!offering) {
      return [];
    }

    const byType = new Map<PACKAGE_TYPE, PurchasesPackage>();
    for (const pkg of offering.availablePackages) {
      byType.set(pkg.packageType, pkg);
    }

    const plans: DefaultOfferingPlan[] = [];
    for (const spec of DEFAULT_OFFERING_PLAN_ORDER) {
      const pkg = byType.get(spec.packageType);
      if (!pkg) {
        continue;
      }

      plans.push({
        packageType: spec.packageType,
        monthsCount: spec.monthsCount,
        pkg,
      });
    }

    return plans;
  } catch (error) {
    console.warn('[RevenueCat] getOfferings unavailable:', error);
    return [];
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
