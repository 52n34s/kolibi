import { createMMKV } from 'react-native-mmkv';

import type { StringKvStorage } from '@/lib/workouts/kv-storage';

/** "Heute nicht" per user and local day, on this device only. */
const storage: StringKvStorage = createMMKV({ id: 'app-settings' });

function skippedKey(userId: string): string {
  return `checkin.skippedOn.${userId}`;
}

export function readCheckinSkippedOn(userId: string): string | null {
  try {
    return storage.getString(skippedKey(userId)) ?? null;
  } catch {
    return null;
  }
}

export function writeCheckinSkippedOn(userId: string, dateKey: string): void {
  try {
    storage.set(skippedKey(userId), dateKey);
  } catch {
    // Worst case the card comes back once more today.
  }
}
