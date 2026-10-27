import type { ContentPackRow, FocusSession, InboxRow, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding } from '../../domain/types';
import type { BackupData } from '../../domain/backup';
import { migrateRows } from '../../db/migrations';
import type { Commit, PersistedState, StorageAdapter } from './index';

/** Same stores as the Dexie schema, each keyed by one field. */
export const STORES = {
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
export type Store = keyof typeof STORES;
export type Row = Record<string, unknown>;

/** What a row store needs from its backend: rows by store and key, inside a transaction. */
export interface RowTx {
  all(store: Store): Promise<Row[]>;
  has(store: Store, key: string): Promise<boolean>;
  put(store: Store, row: Row): Promise<void>;
  delete(store: Store, key: string): Promise<void>;
  clear(store: Store): Promise<void>;
}

export interface RowBackend {
  /** Runs `fn` atomically: every write or none (memory: checks happen before writes). */
  transaction<T>(fn: (tx: RowTx) => Promise<T>): Promise<T>;
}

export const keyOfRow = (store: Store, row: Row): string => String(row[STORES[store]]);

/**
 * The storage contract (`StorageAdapter`) over any row backend: the memory adapter and the native
 * SQLite adapter share it (Step 6.2), so they behave the same as the Dexie one. Rows are stored in the
 * current schema; `migrateRows` upgrades older ones (backups, a SQLite file from an older app).
 */
export function createRowStorage(backend: RowBackend, schemaVersion: number): StorageAdapter {
  const by = <T>(rows: Row[], key: (r: T) => number) => (rows as T[]).sort((a, b) => key(a) - key(b));
  const kv = (tx: RowTx, key: string, value: unknown) => tx.put('kv', { key, value });

  return {
    schemaVersion,
    load: () =>
      backend.transaction(async (tx) => {
        const state: PersistedState = {
          animals: by<PlacedAnimal>(await tx.all('animals'), (a) => a.acquiredAt),
          sessions: by<FocusSession>(await tx.all('sessions'), (s) => s.startedAt),
          inbox: by<InboxRow>(await tx.all('inbox'), (n) => n.createdAt),
          ledger: by<LedgerEntry>(await tx.all('ledger'), (e) => e.at),
          cosmetics: by<OwnedCosmetic>(await tx.all('cosmetics'), (c) => c.acquiredAt),
          placedBuildings: by<PlacedBuilding>(await tx.all('placedBuildings'), (b) => b.placedAt),
          islandHistory: by<IslandHistoryEntry>(await tx.all('islandHistory'), (h) => h.to),
          contentPacks: by<ContentPackRow>(await tx.all('contentPacks'), (p) => p.fetchedAt),
        };
        for (const { key, value } of (await tx.all('kv')) as { key: 'settings' | 'world' | 'phase' | 'equipped' | 'account'; value: never }[]) state[key] = value;
        return state;
      }),
    exportAll: () => backend.transaction(async (tx) => Object.fromEntries(await Promise.all((Object.keys(STORES) as Store[]).map(async (s) => [s, await tx.all(s)] as const)))),
    async importAll(backupData: BackupData, fromVersion: number) {
      const data = migrateRows(backupData, fromVersion);
      await backend.transaction(async (tx) => {
        for (const store of Object.keys(STORES) as Store[]) {
          await tx.clear(store);
          for (const row of data[store] ?? []) await tx.put(store, row as Row);
        }
      });
    },
    saveSettings: (s) => backend.transaction((tx) => kv(tx, 'settings', s)),
    saveWorld: (w) => backend.transaction((tx) => kv(tx, 'world', w)),
    resetWorld: (w) =>
      backend.transaction(async (tx) => {
        await kv(tx, 'world', w);
        await tx.clear('animals');
      }),
    commit: (change: Commit) =>
      backend.transaction(async (tx) => {
        // Checked before any write, so a rejected commit changes nothing (like the Dexie transaction).
        for (const e of change.ledgerAdd ?? []) if (await tx.has('ledger', e.id)) throw new Error('Ledger entries are append-only');
        for (const e of change.ledgerAdd ?? []) await tx.put('ledger', e as unknown as Row);
        for (const e of change.ledgerSync ?? []) if (!(await tx.has('ledger', e.id))) await tx.put('ledger', e as unknown as Row);
        for (const c of change.cosmeticsAdd ?? []) await tx.put('cosmetics', c as unknown as Row);
        if (change.equipped) await kv(tx, 'equipped', change.equipped);
        for (const b of change.buildingsPut ?? []) await tx.put('placedBuildings', b as unknown as Row);
        for (const id of change.buildingsRemove ?? []) await tx.delete('placedBuildings', id);
        if (change.world) await kv(tx, 'world', change.world);
        for (const h of change.islandHistoryAdd ?? []) await tx.put('islandHistory', h as unknown as Row);
        for (const s of change.sessions ?? []) await tx.put('sessions', s as unknown as Row);
        if (change.session) await tx.put('sessions', change.session as unknown as Row);
        if (change.animal) await tx.put('animals', change.animal as unknown as Row);
        for (const a of change.animals ?? []) await tx.put('animals', a as unknown as Row);
        for (const n of change.inboxAdd ?? []) await tx.put('inbox', n as unknown as Row);
        for (const id of change.inboxRemove ?? []) await tx.delete('inbox', id);
        if (change.contentPack) await tx.put('contentPacks', change.contentPack as unknown as Row);
        if (change.account === null) await tx.delete('kv', 'account');
        else if (change.account) await kv(tx, 'account', change.account);
        if (change.phase) {
          if (change.phase.kind === 'idle') await tx.delete('kv', 'phase');
          else await kv(tx, 'phase', change.phase);
        }
      }),
  };
}
