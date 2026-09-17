import { createMMKV } from 'react-native-mmkv';

const OBSERVED_PROMPT_DISMISSED_UNTIL_KEY = 'observed_goal_prompt_dismissed_until';
const storage = createMMKV({ id: 'app-settings' });

/** YYYY-MM-DD until which the update prompt stays hidden, or null. */
export function getObservedPromptDismissedUntil(): string | null {
  const value = storage.getString(OBSERVED_PROMPT_DISMISSED_UNTIL_KEY);
  return value && value.length > 0 ? value : null;
}

export function setObservedPromptDismissedUntil(dateKey: string): void {
  storage.set(OBSERVED_PROMPT_DISMISSED_UNTIL_KEY, dateKey);
}

export function clearObservedPromptDismissedUntil(): void {
  storage.remove(OBSERVED_PROMPT_DISMISSED_UNTIL_KEY);
}
