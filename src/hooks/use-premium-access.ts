import { useQuery } from '@tanstack/react-query';

import { fetchHasPremiumAccess } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';

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
  const query = useQuery({
    queryKey: ['has-premium-access', userId],
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

export function useTrialStatus(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['trial-status', userId],
    enabled: !!userId,
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

  const status = computeTrialStatus(query.data ?? null);

  return {
    isInTrial: status.isInTrial,
    daysLeft: status.daysLeft,
    endsAt: status.endsAt,
    isLoading: query.isLoading,
  };
}
