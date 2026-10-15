import type { FocusSession, PlacedAnimal } from '../../domain/types';
import type { BackupData } from '../../domain/backup';
import type { Commit, PersistedState, StorageAdapter } from './index';

/** Same stores as the Dexie schema, each a map from primary key to row. */
const STORES = { kv: 'key', sessions: 'id', animals: 'id' } as const;
type Store = keyof typeof STORES;
type Row = Record<string, unknown>;

/** Non-persistent adapter: used in tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryStorage(schemaVersion = 3): StorageAdapter {
  const tables = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map<string, Row>()])) as Record<Store, Map<string, Row>>;
  const put = (store: Store, row: object) => tables[store].set((row as Row)[STORES[store]] as string, structuredClone(row) as Row);
  const rows = <T>(store: Store) => [...tables[store].values()].map((r) => structuredClone(r) as T);
  const kv = (key: string, value: unknown) => put('kv', { key, value });

  return {
    schemaVersion,
    async load(): Promise<PersistedState> {
      const state: PersistedState = {
        animals: rows<PlacedAnimal>('animals').sort((a, b) => a.acquiredAt - b.acquiredAt),
        sessions: rows<FocusSession>('sessions').sort((a, b) => a.startedAt - b.startedAt),
      };
      for (const { key, value } of rows<{ key: 'settings' | 'world' | 'phase'; value: never }>('kv')) state[key] = value;
      return state;
    },
    async exportAll() {
      return Object.fromEntries(Object.keys(STORES).map((s) => [s, rows(s as Store)]));
    },
    async importAll(data: BackupData) {
      for (const store of Object.keys(STORES) as Store[]) {
        tables[store].clear();
        for (const row of data[store] ?? []) put(store, row as Row);
      }
    },
    async saveSettings(s) {
      kv('settings', s);
    },
    async saveWorld(w) {
      kv('world', w);
    },
    async resetWorld(w) {
      kv('world', w);
      tables.animals.clear();
    },
    async commit(change: Commit) {
      if (change.session) put('sessions', change.session);
      if (change.animal) put('animals', change.animal);
      if (change.phase) {
        if (change.phase.kind === 'idle') tables.kv.delete('phase');
        else kv('phase', change.phase);
      }
    },
  };
}
