import type { SecureStorageAdapter } from './index';

/** Web: `localStorage` (the browser's own origin isolation is the protection), memory if unavailable. */
export function createWebSecureStorage(): SecureStorageAdapter {
  const memory = new Map<string, string>();
  const ls = (() => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  return {
    async get(key) {
      try {
        return ls ? ls.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    async set(key, value) {
      try {
        if (ls) ls.setItem(key, value);
        else memory.set(key, value);
      } catch {
        memory.set(key, value);
      }
    },
    async remove(key) {
      try {
        ls?.removeItem(key);
      } catch {
        /* ignore */
      }
      memory.delete(key);
    },
  };
}
