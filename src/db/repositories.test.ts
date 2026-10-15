import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDexieStorage } from './repositories';
import { SiftDB } from './schema';
import { startBreak, startFocus } from '../domain/timer/phase';
import type { FocusSession, PlacedAnimal } from '../domain/types';

const session: FocusSession = { id: 's1', startedAt: 10, plannedFocusMs: 1500000, status: 'running' };
const animal: PlacedAnimal = {
  id: 'a1', speciesId: 'chick', tier: 'common', tileX: 1, tileZ: -2, acquiredAt: 20, sessionId: 's1',
};

describe('dexie storage', () => {
  it('starts empty', async () => {
    const s = createDexieStorage(new SiftDB('empty'));
    expect(await s.load()).toEqual({ animals: [], sessions: [] });
  });

  it('round-trips settings, world, and the active phase', async () => {
    const db = new SiftDB('roundtrip');
    const s = createDexieStorage(db);
    await s.saveSettings({ focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark' });
    await s.saveWorld({ seed: 77 });
    await s.commit({ session, phase: startFocus(10, 1500000, 's1') });

    const loaded = await createDexieStorage(new SiftDB('roundtrip')).load();
    expect(loaded.settings).toEqual({ focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark' });
    expect(loaded.world).toEqual({ seed: 77 });
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
    await a.saveSettings({ focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark' });
    await a.saveWorld({ seed: 77 });
    await a.commit({ session: { ...session, status: 'completed', rewardAnimalId: 'a1' }, animal, phase: startBreak(30, 300000, 'a1') });
    const data = await a.exportAll();
    expect(Object.keys(data).sort()).toEqual(['animals', 'kv', 'sessions']);

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
    expect(await s.load()).toEqual({ animals: [], sessions: [] });
  });

  it('reports the schema version', () => {
    expect(createDexieStorage(new SiftDB('verno')).schemaVersion).toBe(3);
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
