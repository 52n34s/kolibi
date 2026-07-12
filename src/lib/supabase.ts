import { createClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.',
  );
}

const secureStore = createChunkedSecureStoreAdapter();

/** Legacy MMKV bucket — read once for migration, then left unused for auth. */
const legacyAuthStorage = createMMKV({ id: 'supabase-auth' });

const authStorageAdapter = {
  getItem: async (key: string) => {
    const value = await secureStore.getItem(key);

    if (value !== null) {
      return value;
    }

    const legacyValue = legacyAuthStorage.getString(key);

    if (legacyValue === undefined) {
      return null;
    }

    await secureStore.setItem(key, legacyValue);
    legacyAuthStorage.remove(key);
    return legacyValue;
  },
  setItem: (key: string, value: string) => secureStore.setItem(key, value),
  removeItem: async (key: string) => {
    await secureStore.removeItem(key);
    legacyAuthStorage.remove(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
