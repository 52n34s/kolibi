import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDayCalorieGoal } from '@/hooks/use-day-meals';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { getActiveEnergyBurned, getSportEnergyDay } from '@/lib/health';
import { MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY } from '@/lib/macros-goals-editor-math';
import { fetchConsumedForLocalDate } from '@/lib/meals';
import { calculateAge } from '@/lib/onboarding';
import { fetchDietPreference } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { getUserPreferenceOrDefault } from '@/lib/user-preferences';
import { useAuthStore } from '@/stores/auth-store';

async function fetchDaySummaryProfile(userId: string): Promise<{
  calorieGoalSource: string | null;
  birthDate: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('calorie_goal_source, birth_date')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    calorieGoalSource:
      typeof data?.calorie_goal_source === 'string' ? data.calorie_goal_source : null,
    birthDate: typeof data?.birth_date === 'string' ? data.birth_date : null,
  };
}

async function fetchLatestWeightKg(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.weight_kg == null ? null : Number(data.weight_kg);
}

/**
 * Shared day summary inputs for Home-style calorie + macro display.
 * Day boundaries come from day-window via fetchConsumedForLocalDate / Health dateKey.
 */
export function useDaySummary(dateKey: string) {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const todayKey = localDateKey();
  const isToday = dateKey === todayKey;

  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const { data: dayGoal, isLoading: goalLoading } = useDayCalorieGoal(userId, dateKey);

  const { data: adaptMacrosToTraining = true } = useQuery({
    queryKey: ['macros-adapt-to-training', userId],
    queryFn: () =>
      getUserPreferenceOrDefault(userId!, MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY, true),
    enabled: Boolean(userId),
  });

  const { data: profile } = useQuery({
    queryKey: ['day-summary-profile', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDaySummaryProfile(userId!),
  });

  const { data: dietPreference } = useQuery({
    queryKey: ['diet-preference', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDietPreference(userId!),
  });

  const { data: latestWeightKg } = useQuery({
    queryKey: ['latest-weight-kg', userId],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: () => fetchLatestWeightKg(userId!),
  });

  const ageYears = useMemo(() => {
    const birthDate = profile?.birthDate;
    if (birthDate == null || birthDate === '') {
      return null;
    }
    try {
      return calculateAge(parseDateOnly(birthDate));
    } catch {
      return null;
    }
  }, [profile?.birthDate]);

  const { data: consumption, isLoading: consumptionLoading } = useQuery({
    queryKey: ['day-consumption', userId, dateKey],
    enabled: Boolean(userId && dateKey),
    queryFn: () => fetchConsumedForLocalDate(userId!, dateKey),
  });

  const sportEnabled =
    healthConnectedPreference === true && adaptMacrosToTraining === true;

  const { data: sportEnergyDay } = useQuery({
    queryKey: ['sport-energy-day', userId, dateKey, ageYears],
    enabled: Boolean(userId) && sportEnabled,
    staleTime: isToday ? 5 * 60 * 1000 : Infinity,
    refetchInterval: isToday ? 5 * 60 * 1000 : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    // Past days: pass dateKey so HealthKit is queried for that local day (not today).
    queryFn: async () =>
      getSportEnergyDay({
        ageYears,
        userId,
        dateKey: isToday ? undefined : dateKey,
      }),
  });

  const { data: activeEnergyBurned } = useQuery({
    queryKey: ['active-energy-burned', userId, dateKey],
    enabled: Boolean(userId) && healthConnectedPreference === true,
    staleTime: isToday ? 5 * 60 * 1000 : Infinity,
    refetchInterval: isToday ? 5 * 60 * 1000 : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    // Past days: same date-scoped HealthKit query as sport energy.
    queryFn: async () => getActiveEnergyBurned(isToday ? undefined : dateKey),
  });

  return {
    userId,
    isToday,
    isLoading: goalLoading || consumptionLoading,
    hasCalorieGoalSource: profile?.calorieGoalSource != null,
    dailyCalorieGoal: dayGoal?.dailyCalorieGoal ?? null,
    dayGoal,
    consumption,
    dietPreference: dietPreference ?? null,
    latestWeightKg: latestWeightKg ?? null,
    healthConnectedPreference,
    adaptMacrosToTraining,
    sportEnergyDay,
    activeEnergyBurned: activeEnergyBurned ?? null,
  };
}
