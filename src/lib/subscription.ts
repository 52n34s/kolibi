import {
  fetchSubscription,
  resolvePremiumAccess,
  type PremiumAccessResult,
  type SubscriptionRow,
} from '@/lib/profile';

export type { PremiumAccessResult, SubscriptionRow };

export async function getPremiumAccess(userId: string): Promise<PremiumAccessResult> {
  const subscription = await fetchSubscription(userId);
  return resolvePremiumAccess(subscription);
}

export { resolvePremiumAccess };
