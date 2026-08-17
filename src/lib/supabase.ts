import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.',
  );
}

/** Metro SSR is platform=web / node — no native SecureStore or MMKV. */
const isNativeClient = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * TEMP (dev only): set `true`, launch once, then set back to `false`.
 * Clears the zombie JWT from chunked SecureStore (and legacy MMKV) before getSession.
 * Hard-gated on `__DEV__` so a forgotten `true` cannot ship in a release build.
 */
export const WIPE_AUTH_STORAGE_ON_LAUNCH = false;

const noopAuthStorage: SupportedStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

function supabaseAuthStorageKeys(): string[] {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const tokenKey = `sb-${projectRef}-auth-token`;
  return [tokenKey, `${tokenKey}-code-verifier`, 'supabase.auth.token'];
}

let wipeAuthStoragePromise: Promise<void> | null = null;

/** No-op unless `__DEV__` and `WIPE_AUTH_STORAGE_ON_LAUNCH` is true. Safe to await more than once. */
export function wipeAuthStorageIfRequested(): Promise<void> {
  if (!__DEV__ || !WIPE_AUTH_STORAGE_ON_LAUNCH || !isNativeClient) {
    return Promise.resolve();
  }

  if (!wipeAuthStoragePromise) {
    wipeAuthStoragePromise = (async () => {
      const { createChunkedSecureStoreAdapter } =
        require('@/lib/chunked-secure-store') as typeof import('@/lib/chunked-secure-store');
      const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');

      const secureStore = createChunkedSecureStoreAdapter();
      const legacyAuthStorage = createMMKV({ id: 'supabase-auth' });
      const keys = supabaseAuthStorageKeys();

      for (const key of keys) {
        await secureStore.removeItem(key);
        legacyAuthStorage.remove(key);
      }

      console.warn('[auth] WIPE_AUTH_STORAGE_ON_LAUNCH: cleared chunked auth keys', keys);
    })();
  }

  return wipeAuthStoragePromise;
}

function createNativeAuthStorage(): SupportedStorage {
  // Lazy require so Expo Router SSR never evaluates expo-secure-store / mmkv.
  const { createChunkedSecureStoreAdapter } =
    require('@/lib/chunked-secure-store') as typeof import('@/lib/chunked-secure-store');
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');

  const secureStore = createChunkedSecureStoreAdapter();
  /** Legacy MMKV bucket — read once for migration, then left unused for auth. */
  const legacyAuthStorage = createMMKV({ id: 'supabase-auth' });

  return {
    getItem: async (key: string) => {
      // Must run before the GoTrue constructor recovers a session from Keychain.
      await wipeAuthStorageIfRequested();

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
    setItem: async (key: string, value: string) => {
      await wipeAuthStorageIfRequested();
      return secureStore.setItem(key, value);
    },
    removeItem: async (key: string) => {
      await wipeAuthStorageIfRequested();
      await secureStore.removeItem(key);
      legacyAuthStorage.remove(key);
    },
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isNativeClient ? createNativeAuthStorage() : noopAuthStorage,
    persistSession: isNativeClient,
    autoRefreshToken: isNativeClient,
    detectSessionInUrl: false,
  },
});
