import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { searchFoodsByName } from '@/lib/food-name-search';
import type { FoodSearchProduct } from '@/services/barcode/OpenFoodFactsService';

export const FOOD_NAME_SEARCH_MIN_LENGTH = 3;
export const FOOD_NAME_SEARCH_DEBOUNCE_MS = 350;
export const FOOD_NAME_SEARCH_CACHE_MAX_ENTRIES = 50;

type SearchCacheEntry = {
  results: FoodSearchProduct[];
  rateLimited: boolean;
  searchUnavailable: boolean;
};

function buildCacheKey(query: string, localeKey: string): string {
  return `${localeKey}:${query.trim().toLowerCase()}`;
}

function setCacheEntry(
  cache: Map<string, SearchCacheEntry>,
  key: string,
  entry: SearchCacheEntry,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, entry);

  while (cache.size > FOOD_NAME_SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

function applyUnavailableState(
  cacheRef: MutableRefObject<Map<string, SearchCacheEntry>>,
  cacheKey: string,
  setters: {
    setResults: (results: FoodSearchProduct[]) => void;
    setRateLimited: (rateLimited: boolean) => void;
    setSearchUnavailable: (searchUnavailable: boolean) => void;
    setIsSearching: (isSearching: boolean) => void;
    setHasSettled: (hasSettled: boolean) => void;
  },
) {
  setCacheEntry(cacheRef.current, cacheKey, {
    results: [],
    rateLimited: false,
    searchUnavailable: true,
  });
  setters.setResults([]);
  setters.setRateLimited(false);
  setters.setSearchUnavailable(true);
  setters.setIsSearching(false);
  setters.setHasSettled(true);
}

export function useFoodNameSearch(query: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const [results, setResults] = useState<FoodSearchProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [hasSettled, setHasSettled] = useState(false);
  const cacheRef = useRef<Map<string, SearchCacheEntry>>(new Map());
  const requestIdRef = useRef(0);

  const localeKey = resolveLanguageCode(i18n.language);
  const trimmedQuery = query.trim();
  const canSearch = enabled && trimmedQuery.length >= FOOD_NAME_SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setResults([]);
      setIsSearching(false);
      setRateLimited(false);
      setSearchUnavailable(false);
      setHasSettled(false);
      return;
    }

    if (!canSearch) {
      requestIdRef.current += 1;
      setResults([]);
      setIsSearching(false);
      setRateLimited(false);
      setSearchUnavailable(false);
      setHasSettled(false);
      return;
    }

    const cacheKey = buildCacheKey(trimmedQuery, localeKey);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached.results);
      setRateLimited(cached.rateLimited);
      setSearchUnavailable(cached.searchUnavailable);
      setIsSearching(false);
      setHasSettled(true);
      return;
    }

    setIsSearching(true);
    setRateLimited(false);
    setSearchUnavailable(false);
    setHasSettled(false);

    const debounceId = setTimeout(() => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const setters = {
        setResults,
        setRateLimited,
        setSearchUnavailable,
        setIsSearching,
        setHasSettled,
      };

      void searchFoodsByName(trimmedQuery, localeKey)
        .then((products) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setCacheEntry(cacheRef.current, cacheKey, {
            results: products,
            rateLimited: false,
            searchUnavailable: false,
          });
          setResults(products);
          setRateLimited(false);
          setSearchUnavailable(false);
          setIsSearching(false);
          setHasSettled(true);
        })
        .catch((error) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          console.error('[useFoodNameSearch] foods search failed:', error);
          applyUnavailableState(cacheRef, cacheKey, setters);
        });
    }, FOOD_NAME_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceId);
    };
  }, [canSearch, enabled, localeKey, trimmedQuery]);

  return {
    results,
    isSearching,
    rateLimited,
    searchUnavailable,
    canSearch,
    hasSettled,
    trimmedQuery,
  };
}

function resolveLanguageCode(language: string): string {
  return language.split('-')[0]?.toLowerCase() ?? 'en';
}
