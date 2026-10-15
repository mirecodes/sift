import type { FocusSession, InboxRow, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding } from '../../domain/types';
import type { BackupData } from '../../domain/backup';
import { migrateRows, SCHEMA_VERSION } from '../../db/migrations';
import type { Commit, PersistedState, StorageAdapter } from './index';

/** Same stores as the Dexie schema, each a map from primary key to row. */
const STORES = {
  kv: 'key',
  sessions: 'id',
  animals: 'id',
  ledger: 'id',
  cosmetics: 'id',
  placedBuildings: 'id',
  islandHistory: 'id',
  inbox: 'id',
  contentPacks: 'contentVersion',
} as const;
type Store = keyof typeof STORES;
type Row = Record<string, unknown>;

/** Non-persistent adapter: used in tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryStorage(): StorageAdapter {
  const schemaVersion = SCHEMA_VERSION;
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
        inbox: rows<InboxRow>('inbox').sort((a, b) => a.createdAt - b.createdAt),
        ledger: rows<LedgerEntry>('ledger').sort((a, b) => a.at - b.at),
        cosmetics: rows<OwnedCosmetic>('cosmetics').sort((a, b) => a.acquiredAt - b.acquiredAt),
        placedBuildings: rows<PlacedBuilding>('placedBuildings').sort((a, b) => a.placedAt - b.placedAt),
      };
      for (const { key, value } of rows<{ key: 'settings' | 'world' | 'phase' | 'equipped'; value: never }>('kv')) state[key] = value;
      return state;
    },
    async exportAll() {
      return Object.fromEntries(Object.keys(STORES).map((s) => [s, rows(s as Store)]));
    },
    async importAll(backupData: BackupData, fromVersion: number) {
      const data = migrateRows(backupData, fromVersion);
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
      // Checked before any write, so a rejected commit changes nothing (like the Dexie transaction).
      if (change.ledgerAdd?.some((e) => tables.ledger.has(e.id))) throw new Error('Ledger entries are append-only');
      for (const e of change.ledgerAdd ?? []) put('ledger', e);
      for (const c of change.cosmeticsAdd ?? []) put('cosmetics', c);
      if (change.equipped) kv('equipped', change.equipped);
      for (const b of change.buildingsPut ?? []) put('placedBuildings', b);
      for (const id of change.buildingsRemove ?? []) tables.placedBuildings.delete(id);
      if (change.session) put('sessions', change.session);
      if (change.animal) put('animals', change.animal);
      for (const a of change.animals ?? []) put('animals', a);
      for (const n of change.inboxAdd ?? []) put('inbox', n);
      for (const id of change.inboxRemove ?? []) tables.inbox.delete(id);
      if (change.phase) {
        if (change.phase.kind === 'idle') tables.kv.delete('phase');
        else kv('phase', change.phase);
      }
    },
  };
}
