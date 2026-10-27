import type { Equipped, Settings, WorldState } from '../domain/types';
import type { StoredPhase } from '../domain/timer/phase';
import type { Commit, PersistedState, StorageAdapter } from '../platform/storage';
import { SiftDB } from './schema';
import { migrateRows } from './migrations';

export function createDexieStorage(db: SiftDB = new SiftDB()): StorageAdapter {
  return {
    schemaVersion: db.verno,

    async load(): Promise<PersistedState> {
      const [kv, animals, sessions, inbox, ledger, cosmetics, placedBuildings, islandHistory] = await Promise.all([
        db.kv.toArray(),
        db.animals.orderBy('acquiredAt').toArray(),
        db.sessions.orderBy('startedAt').toArray(),
        db.inbox.orderBy('createdAt').toArray(),
        db.ledger.orderBy('at').toArray(),
        db.cosmetics.toArray().then((rows) => rows.sort((a, b) => a.acquiredAt - b.acquiredAt)),
        db.placedBuildings.toArray().then((rows) => rows.sort((a, b) => a.placedAt - b.placedAt)),
        db.islandHistory.toArray().then((rows) => rows.sort((a, b) => a.to - b.to)),
      ]);
      const get = <T>(key: string): T | undefined => kv.find((r) => r.key === key)?.value as T | undefined;
      const state: PersistedState = { animals, sessions, inbox, ledger, cosmetics, placedBuildings, islandHistory };
      const settings = get<Settings>('settings');
      const world = get<WorldState>('world');
      const phase = get<StoredPhase>('phase');
      const equipped = get<Equipped>('equipped');
      if (settings) state.settings = settings;
      if (world) state.world = world;
      if (phase) state.phase = phase;
      if (equipped) state.equipped = equipped;
      return state;
    },

    async exportAll() {
      return db.transaction('r', db.tables, async () =>
        Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()] as const))),
      );
    },

    async importAll(backupData, schemaVersion) {
      const data = migrateRows(backupData, schemaVersion);
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
          const rows = data[table.name];
          if (rows?.length) await table.bulkAdd(rows);
        }
      });
    },

    async saveSettings(settings) {
      await db.kv.put({ key: 'settings', value: settings });
    },

    async saveWorld(world) {
      await db.kv.put({ key: 'world', value: world });
    },

    async resetWorld(world) {
      await db.transaction('rw', db.kv, db.animals, async () => {
        await db.kv.put({ key: 'world', value: world });
        await db.animals.clear();
      });
    },

    /** Session, animals, active phase, inbox, ledger, items, equipped and buildings are written in ONE transaction (ARCHITECTURE.md 7.3). */
    async commit(change: Commit) {
      await db.transaction('rw', [db.kv, db.sessions, db.animals, db.inbox, db.ledger, db.cosmetics, db.placedBuildings, db.islandHistory], async () => {
        if (change.world) await db.kv.put({ key: 'world', value: change.world });
        if (change.islandHistoryAdd?.length) await db.islandHistory.bulkPut(change.islandHistoryAdd);
        if (change.ledgerAdd?.length) await db.ledger.bulkAdd(change.ledgerAdd); // add, not put: append-only
        if (change.cosmeticsAdd?.length) await db.cosmetics.bulkPut(change.cosmeticsAdd);
        if (change.equipped) await db.kv.put({ key: 'equipped', value: change.equipped });
        if (change.buildingsPut?.length) await db.placedBuildings.bulkPut(change.buildingsPut);
        if (change.buildingsRemove?.length) await db.placedBuildings.bulkDelete(change.buildingsRemove);
        if (change.inboxAdd?.length) await db.inbox.bulkPut(change.inboxAdd);
        if (change.inboxRemove?.length) await db.inbox.bulkDelete(change.inboxRemove);
        if (change.session) await db.sessions.put(change.session);
        if (change.animal) await db.animals.put(change.animal);
        if (change.animals?.length) await db.animals.bulkPut(change.animals);
        if (change.phase) {
          if (change.phase.kind === 'idle') await db.kv.delete('phase');
          else await db.kv.put({ key: 'phase', value: change.phase });
        }
      });
    },
  };
}
