import { createMMKV } from 'react-native-mmkv';

import type { FoodSuggestionMode } from '@/lib/food-suggestions';

const MEAL_SUGGEST_MODE_STORAGE_KEY = 'meal_suggest_mode';
const DEFAULT_MEAL_SUGGEST_MODE: FoodSuggestionMode = 'recent';
const storage = createMMKV({ id: 'app-settings' });

export function getStoredMealSuggestMode(): FoodSuggestionMode {
  const saved = storage.getString(MEAL_SUGGEST_MODE_STORAGE_KEY);
  if (saved === 'recent' || saved === 'frequent') {
    return saved;
  }

  return DEFAULT_MEAL_SUGGEST_MODE;
}

export function setStoredMealSuggestMode(mode: FoodSuggestionMode) {
  storage.set(MEAL_SUGGEST_MODE_STORAGE_KEY, mode);
}
