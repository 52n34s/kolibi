import { useQuery } from '@tanstack/react-query';

import {
  fetchTopContributingFoods,
  type BalanceNutrient,
} from '@/lib/history-balance';
import { localDateKey } from '@/lib/day-window';
import { fetchSupplementHistory } from '@/lib/supplements';

export function useTopContributingFoods(
  userId: string | undefined,
  nutrient: BalanceNutrient | null,
  languageCode: string,
) {
  return useQuery({
    queryKey: ['history-balance-top-foods', userId, nutrient, languageCode],
    enabled: !!userId && nutrient != null,
    queryFn: () => fetchTopContributingFoods(userId!, nutrient!, languageCode),
  });
}

function lastSevenDayRange(to: string): { from: string; to: string } {
  const fromDate = new Date(`${to}T12:00:00`);
  fromDate.setDate(fromDate.getDate() - 6);
  return { from: localDateKey(fromDate), to };
}

/** Active supplement adherence for the balance card's fixed seven-day window. */
export function useBalanceSupplementHistory(userId: string | undefined, today: string) {
  const { from, to } = lastSevenDayRange(today);

  return useQuery({
    queryKey: ['history-balance-supplements', userId, from, to],
    enabled: !!userId,
    queryFn: () => fetchSupplementHistory(from, to),
  });
}
