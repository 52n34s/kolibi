import type { StateStorage } from 'zustand/middleware';

type MmkvLike = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string | number | boolean) => void;
  remove: (key: string) => void;
};

const instances = new Map<string, MmkvLike>();

/** Shared MMKV instance by id (lazy require — safe for node:test). */
export function getMmkv(id: string): MmkvLike {
  const existing = instances.get(id);
  if (existing) {
    return existing;
  }
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  const mmkv = createMMKV({ id });
  instances.set(id, mmkv);
  return mmkv;
}

/** Zustand `persist` storage adapter for an MMKV instance id. */
export function createMmkvZustandStorage(id: string): StateStorage {
  return {
    getItem: (name) => {
      const value = getMmkv(id).getString(name);
      return value === undefined ? null : value;
    },
    setItem: (name, value) => {
      getMmkv(id).set(name, value);
    },
    removeItem: (name) => {
      getMmkv(id).remove(name);
    },
  };
}
