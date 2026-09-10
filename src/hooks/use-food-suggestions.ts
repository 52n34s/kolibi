import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { resolveLanguageCode } from '@/lib/food-name-search';
import { fetchTopFoods } from '@/lib/food-suggestions';

/** History changes slowly — one fetch covers a whole entry session. */
const FOOD_SUGGESTIONS_STALE_TIME_MS = 5 * 60 * 1000;

export function useFoodSuggestions(userId: string | undefined, enabled: boolean) {
  const { i18n } = useTranslation();
  const localeKey = resolveLanguageCode(i18n.language);

  return useQuery({
    queryKey: ['meal-food-suggestions', userId, localeKey],
    queryFn: () => fetchTopFoods(localeKey),
    enabled: Boolean(userId) && enabled,
    staleTime: FOOD_SUGGESTIONS_STALE_TIME_MS,
  });
}
