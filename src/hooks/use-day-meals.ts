import { useQuery } from '@tanstack/react-query';

import { fetchCalorieGoalForDate } from '@/lib/calorie-goals';
import { fetchDailyHealthStatsForDate } from '@/lib/daily-health-stats';
import { fetchMealsForLocalDate, hasLoggedAnyMealEver } from '@/lib/meals';

export function useDayMeals(userId: string | undefined, dateKey: string) {
  return useQuery({
    queryKey: ['day-meals', userId, dateKey],
    enabled: Boolean(userId && dateKey),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return fetchMealsForLocalDate(userId, dateKey);
    },
  });
}

/** For the empty-state copy: has this user logged a meal on ANY day, ever? */
export function useHasLoggedAnyMeal(userId: string | undefined) {
  return useQuery({
    queryKey: ['has-logged-any-meal', userId],
    enabled: Boolean(userId),
    queryFn: () => hasLoggedAnyMealEver(userId!),
  });
}

export function useDayCalorieGoal(userId: string | undefined, dateKey: string) {
  return useQuery({
    queryKey: ['calorie-goal-for-date', userId, dateKey],
    enabled: Boolean(userId && dateKey),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return fetchCalorieGoalForDate(userId, dateKey);
    },
  });
}

export function useDayHealthStats(userId: string | undefined, dateKey: string) {
  return useQuery({
    queryKey: ['daily-health-stats', userId, dateKey],
    enabled: Boolean(userId && dateKey),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return fetchDailyHealthStatsForDate(userId, dateKey);
    },
  });
}
