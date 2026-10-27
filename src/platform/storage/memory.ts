import { SCHEMA_VERSION } from '../../db/migrations';
import type { StorageAdapter } from './index';
import { createRowStorage, keyOfRow, STORES, type Row, type Store } from './rows';

/** Non-persistent adapter: used in tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryStorage(): StorageAdapter {
  const tables = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map<string, Row>()])) as Record<Store, Map<string, Row>>;
  return createRowStorage(
    {
      // Single-threaded: a transaction cannot interleave with another; checks run before writes.
      transaction: (fn) =>
        fn({
          all: async (store) => [...tables[store].values()].map((r) => structuredClone(r)),
          has: async (store, key) => tables[store].has(key),
          put: async (store, row) => void tables[store].set(keyOfRow(store, row), structuredClone(row)),
          delete: async (store, key) => void tables[store].delete(key),
          clear: async (store) => tables[store].clear(),
        }),
    },
    SCHEMA_VERSION,
  );
}
