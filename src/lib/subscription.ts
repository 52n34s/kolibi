import { supabase } from '@/lib/supabase';

import type { SubscriptionRow } from '@/lib/profile';

export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export type SubscriptionStatusKind = 'trial' | 'active' | 'override' | 'none';

export type SubscriptionStatusDisplay = {
  kind: SubscriptionStatusKind;
  /** ISO date for trial end or subscription period end, when applicable. */
  relevantUntil: string | null;
};

export async function fetchHasPremiumAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_premium_access', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export function resolveSubscriptionStatusDisplay(params: {
  hasPremiumAccess: boolean;
  trialEndsAt: string | null;
  subscription: SubscriptionRow | null;
}): SubscriptionStatusDisplay {
  const { hasPremiumAccess, trialEndsAt, subscription } = params;

  if (!hasPremiumAccess) {
    return { kind: 'none', relevantUntil: null };
  }

  if (
    subscription?.access_override === 'free_forever' ||
    (subscription?.access_override === 'free_until' &&
      subscription.access_override_until &&
      new Date(subscription.access_override_until) > new Date())
  ) {
    return {
      kind: 'override',
      relevantUntil: subscription.access_override_until,
    };
  }

  if (subscription?.is_active && subscription.current_period_end) {
    return {
      kind: 'active',
      relevantUntil: subscription.current_period_end,
    };
  }

  if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
    return {
      kind: 'trial',
      relevantUntil: trialEndsAt,
    };
  }

  return { kind: 'none', relevantUntil: null };
}

export function formatSubscriptionStatusDate(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
