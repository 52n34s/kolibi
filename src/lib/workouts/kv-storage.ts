/** Minimal string KV used by the workout sync queue (MMKV or in-memory for tests). */
export type StringKvStorage = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
};

export function createMemoryKvStorage(
  initial: Record<string, string> = {},
): StringKvStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}
