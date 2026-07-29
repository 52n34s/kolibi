import { useQuery } from '@tanstack/react-query';

import { fetchCalorieGoalForDate } from '@/lib/calorie-goals';
import { fetchMealsForLocalDate } from '@/lib/meals';

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
