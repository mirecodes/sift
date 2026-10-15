import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDexieStorage } from './repositories';
import { SiftDB } from './schema';
import { startBreak, startFocus } from '../domain/timer/phase';
import type { FocusSession, PlacedAnimal, Settings } from '../domain/types';
import { migrateRows } from './migrations';

const session: FocusSession = { id: 's1', startedAt: 10, plannedFocusMs: 1500000, status: 'running', togetherRoomId: null };
const animal: PlacedAnimal = {
  id: 'a1', speciesId: 'chick', tier: 'common', tierRank: 0, tileX: 1, tileZ: -2, acquiredAt: 20, sessionId: 's1',
  status: 'active', endedAt: null, endReason: null, verified: true, pinned: false,
};
const settings: Settings = {
  focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark', weekStartsOn: 1, showFocusPresence: true, liveProgress: true,
};
const world = { seed: 77, blockThemeId: 'default' };

/** Rows exactly as schema 3 stored them (fixture for the v4 migration). */
const V3 = {
  kv: [
    { key: 'settings', value: { focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark' } },
    { key: 'world', value: { seed: 77 } },
    { key: 'phase', value: { kind: 'break', startedAt: 30, plannedMs: 300000, rewardId: 'a2' } },
  ],
  sessions: [
    { id: 's1', startedAt: 10, plannedFocusMs: 1500000, endedAt: 1600000, effectiveFocusMs: 1599990, status: 'completed', rewardAnimalId: 'a1' },
    { id: 's2', startedAt: 2000000, plannedFocusMs: 1500000, endedAt: 2100000, effectiveFocusMs: 100000, status: 'abandoned' },
  ],
  animals: [
    { id: 'a1', speciesId: 'chick', tier: 'common', tileX: 1, tileZ: -2, acquiredAt: 1600000, sessionId: 's1' },
    { id: 'a2', speciesId: 'tiger', tier: 'legendary', tileX: -1, tileZ: 2, acquiredAt: 1700000, sessionId: 's3' },
    { id: 'a3', speciesId: 'fox', tier: 'epic', tileX: 2, tileZ: 2, acquiredAt: 1800000, sessionId: 's4' },
  ],
};
const V4_ANIMAL_FIELDS = { status: 'active', endedAt: null, endReason: null, verified: true, pinned: false };

describe('dexie storage', () => {
  it('starts empty', async () => {
    const s = createDexieStorage(new SiftDB('empty'));
    expect(await s.load()).toEqual({ animals: [], sessions: [], inbox: [] });
  });

  it('round-trips settings, world, and the active phase', async () => {
    const db = new SiftDB('roundtrip');
    const s = createDexieStorage(db);
    await s.saveSettings(settings);
    await s.saveWorld(world);
    await s.commit({ session, phase: startFocus(10, 1500000, 's1') });

    const loaded = await createDexieStorage(new SiftDB('roundtrip')).load();
    expect(loaded.settings).toEqual(settings);
    expect(loaded.world).toEqual(world);
    expect(loaded.phase).toEqual(startFocus(10, 1500000, 's1'));
    expect(loaded.sessions).toEqual([session]);
  });

  it('commits session, animal, and phase together, and idle clears the phase', async () => {
    const s = createDexieStorage(new SiftDB('commit'));
    await s.commit({
      session: { ...session, status: 'completed', rewardAnimalId: 'a1' },
      animal,
      phase: startBreak(30, 300000, 'a1'),
    });
    let loaded = await s.load();
    expect(loaded.animals).toEqual([animal]);
    expect(loaded.sessions[0]?.status).toBe('completed');
    expect(loaded.phase?.kind).toBe('break');

    await s.commit({ phase: { kind: 'idle' } });
    loaded = await s.load();
    expect(loaded.phase).toBeUndefined();
    expect(loaded.animals).toHaveLength(1);
  });

  it('rolls back everything when one write in the transaction fails', async () => {
    const db = new SiftDB('atomic');
    const s = createDexieStorage(db);
    const bad = { ...animal, id: undefined } as unknown as PlacedAnimal; // invalid key -> put throws
    await expect(s.commit({ session, animal: bad, phase: startBreak(1, 1) })).rejects.toThrow();
    const loaded = await s.load();
    expect(loaded.sessions).toEqual([]);
    expect(loaded.phase).toBeUndefined();
  });

  it('exports every store and imports it into an empty database (backup roundtrip)', async () => {
    const a = createDexieStorage(new SiftDB('export-src'));
    await a.saveSettings(settings);
    await a.saveWorld(world);
    await a.commit({ session: { ...session, status: 'completed', rewardAnimalId: 'a1' }, animal, phase: startBreak(30, 300000, 'a1') });
    const data = await a.exportAll();
    expect(Object.keys(data).sort()).toEqual(['animals', 'contentPacks', 'cosmetics', 'inbox', 'islandHistory', 'kv', 'ledger', 'placedBuildings', 'sessions']);

    const b = createDexieStorage(new SiftDB('export-dst'));
    await b.importAll(data, a.schemaVersion);
    expect(await b.load()).toEqual(await a.load());
  });

  it('import replaces everything, or nothing when a row is bad', async () => {
    const s = createDexieStorage(new SiftDB('import-atomic'));
    await s.commit({ session, animal });
    const before = await s.load();
    await expect(s.importAll({ kv: [], sessions: [], animals: [{ ...animal, id: undefined }] }, s.schemaVersion)).rejects.toThrow();
    expect(await s.load()).toEqual(before);

    await s.importAll({ kv: [], sessions: [], animals: [] }, s.schemaVersion);
    expect(await s.load()).toEqual({ animals: [], sessions: [], inbox: [] });
  });

  it('adds and removes inbox notices inside the commit transaction', async () => {
    const s = createDexieStorage(new SiftDB('inbox'));
    const notice = { kind: 'animals_departed' as const, animalIds: ['a1'], gold: 1 };
    await s.commit({ inboxAdd: [{ id: 'n2', createdAt: 20, notice }, { id: 'n1', createdAt: 10, notice }] });
    expect((await s.load()).inbox.map((n) => n.id)).toEqual(['n1', 'n2']);
    await s.commit({ inboxRemove: ['n1'] });
    expect((await s.load()).inbox.map((n) => n.id)).toEqual(['n2']);
  });

  it('reports the schema version', () => {
    expect(createDexieStorage(new SiftDB('verno')).schemaVersion).toBe(4);
  });

  async function v3Database(name: string) {
    const old = new Dexie(name);
    old.version(3).stores({ kv: 'key', sessions: 'id, startedAt', animals: 'id, acquiredAt' });
    await old.table('kv').bulkAdd(structuredClone(V3.kv));
    await old.table('sessions').bulkAdd(structuredClone(V3.sessions));
    await old.table('animals').bulkAdd(structuredClone(V3.animals));
    old.close();
  }

  it('migrates a v3 database to v4: animals become active and verified, nothing else changes', async () => {
    await v3Database('v3-fixture');
    const db = new SiftDB('v3-fixture');
    const data = await createDexieStorage(db).exportAll();

    expect(data.animals).toEqual([
      { ...V3.animals[0], tierRank: 0, ...V4_ANIMAL_FIELDS },
      { ...V3.animals[1], tierRank: 3, ...V4_ANIMAL_FIELDS },
      { ...V3.animals[2], tierRank: 2, ...V4_ANIMAL_FIELDS },
    ]);
    expect(data.sessions).toEqual(V3.sessions.map((s) => ({ ...s, togetherRoomId: null })));
    expect(data.kv).toEqual([
      { key: 'phase', value: V3.kv[2]?.value },
      { key: 'settings', value: { ...V3.kv[0]?.value, weekStartsOn: 1, showFocusPresence: true, liveProgress: true } },
      { key: 'world', value: { seed: 77, blockThemeId: 'default' } },
    ]);
    for (const store of ['ledger', 'cosmetics', 'placedBuildings', 'islandHistory', 'inbox', 'contentPacks']) expect(data[store]).toEqual([]);
    expect(await db.animals.where('status').equals('active').count()).toBe(3);
  });

  it('a v3 backup imports into v4 exactly like the database migration', async () => {
    await v3Database('v3-migrated');
    const migrated = await createDexieStorage(new SiftDB('v3-migrated')).exportAll();
    const s = createDexieStorage(new SiftDB('v3-imported'));
    await s.importAll(structuredClone(V3), 3);
    expect(await s.exportAll()).toEqual(migrated);
  });

  it('migration is a no-op on v4 rows and rejects unsupported schemas', () => {
    const v4 = migrateRows(structuredClone(V3), 3);
    expect(migrateRows(v4, 4)).toBe(v4);
    expect(migrateRows(v4, 3)).toEqual(v4); // re-running the upgrade only adds missing fields
    expect(() => migrateRows(V3, 2)).toThrow();
    expect(() => migrateRows(V3, 5)).toThrow();
  });

  it('renames stored tiers when upgrading from schema 1 (ADR-026, ADR-027)', async () => {
    const old = new Dexie('tier-swap');
    old.version(1).stores({ kv: 'key', sessions: 'id, startedAt', animals: 'id, acquiredAt' });
    await old.table('animals').bulkAdd([
      { ...animal, id: 'top', tier: 'mythic' },
      { ...animal, id: 'third', tier: 'legendary' },
      { ...animal, id: 'second', tier: 'epic' },
    ]);
    old.close();

    const { animals } = await createDexieStorage(new SiftDB('tier-swap')).load();
    const tierOf = (id: string) => animals.find((a) => a.id === id)?.tier;
    // Schema 1 top tier 'mythic' is now 'legendary', the third 'legendary' is 'epic', the second 'epic' is 'mythic'.
    expect([tierOf('top'), tierOf('third'), tierOf('second')]).toEqual(['legendary', 'epic', 'mythic']);
  });
});
