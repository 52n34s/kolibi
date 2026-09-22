import { useQuery } from '@tanstack/react-query';

import {
  getPremiumEntitlementExpirationDate,
  isPremiumEntitlementInTrial,
} from '@/lib/revenuecat-customer-info';
import { fetchHasPremiumAccess } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import { useAuthStore } from '@/stores/auth-store';

export type TrialStatus = {
  isInTrial: boolean;
  daysLeft: number;
  endsAt: Date | null;
};

function computeTrialStatus(trialEndsAt: string | null): TrialStatus {
  if (!trialEndsAt) {
    return { isInTrial: false, daysLeft: 0, endsAt: null };
  }

  const endsAt = new Date(trialEndsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    return { isInTrial: false, daysLeft: 0, endsAt: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(endsAt);
  endDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((endDay.getTime() - today.getTime()) / 86_400_000);

  return {
    isInTrial: true,
    daysLeft: Math.max(0, daysLeft),
    endsAt,
  };
}

export function useHasPremiumAccess(userId: string | undefined) {
  const isAnonymous = useAuthStore((state) => state.session?.user?.is_anonymous === true);
  const query = useQuery({
    queryKey: ['has-premium-access', userId, isAnonymous],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return fetchHasPremiumAccess(userId);
    },
  });

  return {
    hasAccess: query.data ?? false,
    isLoading: query.isLoading,
  };
}

/**
 * Trial UI status: prefer active RevenueCat entitlement in TRIAL/INTRO,
 * fall back to profiles.trial_ends_at for users still on the legacy DB trial.
 */
export function useTrialStatus(userId: string | undefined) {
  const isAnonymous = useAuthStore((state) => state.session?.user?.is_anonymous === true);
  const { customerInfo } = useRevenueCatPremiumEntitlement();

  const rcTrial = isPremiumEntitlementInTrial(customerInfo);
  const rcExpiresAt = getPremiumEntitlementExpirationDate(customerInfo);
  const rcStatus = rcTrial ? computeTrialStatus(rcExpiresAt) : null;

  const dbQuery = useQuery({
    queryKey: ['trial-status', userId, isAnonymous],
    enabled: !!userId && !rcTrial,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('trial_ends_at')
        .eq('id', userId)
        .maybeSingle<{ trial_ends_at: string | null }>();

      if (error) {
        throw error;
      }

      return data?.trial_ends_at ?? null;
    },
  });

  if (rcStatus?.isInTrial) {
    return {
      isInTrial: true,
      daysLeft: rcStatus.daysLeft,
      endsAt: rcStatus.endsAt,
      isLoading: false,
      source: 'revenuecat' as const,
    };
  }

  const dbStatus = computeTrialStatus(dbQuery.data ?? null);

  return {
    isInTrial: dbStatus.isInTrial,
    daysLeft: dbStatus.daysLeft,
    endsAt: dbStatus.endsAt,
    isLoading: dbQuery.isLoading,
    source: 'database' as const,
  };
}
