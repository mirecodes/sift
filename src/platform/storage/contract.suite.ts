import { describe, expect, it } from 'vitest';
import { startBreak, startFocus } from '../../domain/timer/phase';
import type { FocusSession, PlacedAnimal, Settings } from '../../domain/types';
import type { StorageAdapter } from './index';

const session: FocusSession = { id: 's1', startedAt: 10, plannedFocusMs: 1500000, status: 'running', togetherRoomId: null };
const animal = (id: string, acquiredAt: number): PlacedAnimal => ({
  id, speciesId: 'chick', tier: 'common', tierRank: 0, tileX: 1, tileZ: -2, acquiredAt, sessionId: 's1',
  status: 'active', endedAt: null, endReason: null, verified: true, pinned: false,
});
const settings: Settings = { focusMinutes: 30, breakMinutes: 10, soundEnabled: false, theme: 'dark', weekStartsOn: 1, showFocusPresence: true, liveProgress: true };

/**
 * The storage contract every adapter passes (guidance_v2 §10: "storage adapters share one contract test
 * suite"): IndexedDB (web), SQLite (iOS/Android) and memory.
 */
export function describeStorageContract(name: string, make: () => Promise<StorageAdapter> | StorageAdapter) {
  describe(`storage contract (${name})`, () => {
    it('starts empty and keeps singletons', async () => {
      const s = await make();
      expect(await s.load()).toEqual({ animals: [], sessions: [], inbox: [], ledger: [], cosmetics: [], placedBuildings: [], islandHistory: [], contentPacks: [] });
      await s.saveSettings(settings);
      await s.saveWorld({ seed: 7, blockThemeId: 'default' });
      expect(await s.load()).toMatchObject({ settings, world: { seed: 7 } });
    });

    it('commits a session, animals, phase, ledger, inbox, items and buildings together, sorted on load', async () => {
      const s = await make();
      await s.commit({ session, phase: startFocus(10, 1500000, 's1') });
      await s.commit({
        animals: [animal('b', 30), animal('a', 20)],
        phase: startBreak(40, 300000, 'a'),
        ledgerAdd: [{ id: 'l1', at: 2, currency: 'gold', amount: 30, reason: 'starter', refId: null }],
        inboxAdd: [{ id: 'n1', createdAt: 5, notice: { kind: 'friend_request', userId: 'x' } }],
        cosmeticsAdd: [{ id: 'c1', kind: 'building', defId: 'fence', acquiredAt: 3, source: 'shop' }],
        buildingsPut: [{ id: 'b1', defId: 'fence', tileX: 1, tileZ: 1, rotation: 90, placedAt: 4 }],
        equipped: { skinsBySpecies: { fox: ['golden:fox'] }, blockThemeId: 'snow' },
        account: { userId: 'u', email: null, seq: 3, outbox: [], pendingEnds: [] },
      });
      const l = await s.load();
      expect(l.animals.map((a) => a.id)).toEqual(['a', 'b']);
      expect(l.phase).toEqual(startBreak(40, 300000, 'a'));
      expect(l.ledger).toHaveLength(1);
      expect(l.inbox).toHaveLength(1);
      expect(l.cosmetics).toHaveLength(1);
      expect(l.placedBuildings[0]).toMatchObject({ rotation: 90 });
      expect(l.equipped).toEqual({ skinsBySpecies: { fox: ['golden:fox'] }, blockThemeId: 'snow' });
      expect(l.account).toMatchObject({ userId: 'u', seq: 3 });
      await s.commit({ phase: { kind: 'idle' }, buildingsRemove: ['b1'], inboxRemove: ['n1'], account: null });
      const after = await s.load();
      expect(after.phase).toBeUndefined();
      expect(after.placedBuildings).toEqual([]);
      expect(after.inbox).toEqual([]);
      expect(after.account).toBeUndefined();
    });

    it('keeps the ledger append-only: a repeated id rejects the whole commit; synced rows are skipped', async () => {
      const s = await make();
      const e = { id: 'l1', at: 1, currency: 'gold' as const, amount: 5, reason: 'x', refId: null };
      await s.commit({ ledgerAdd: [e] });
      await expect(s.commit({ ledgerAdd: [e], animal: animal('z', 1) })).rejects.toThrow();
      expect((await s.load()).animals).toEqual([]);
      await s.commit({ ledgerSync: [e, { ...e, id: 'l2' }] });
      expect((await s.load()).ledger.map((x) => x.id).sort()).toEqual(['l1', 'l2']);
    });

    it('exports every store and imports it back exactly, replacing what was there', async () => {
      const s = await make();
      await s.saveSettings(settings);
      await s.commit({ session, animals: [animal('a', 1)], contentPack: { contentVersion: '9', checksum: 'c', json: '{}', atlas: '', fetchedAt: 1 } });
      const data = await s.exportAll();
      const t = await make();
      await t.commit({ animals: [animal('old', 1)] });
      await t.importAll(data, s.schemaVersion);
      expect(await t.load()).toEqual(await s.load());
    });

    it('resets the world and its animals in one step', async () => {
      const s = await make();
      await s.commit({ animals: [animal('a', 1)] });
      await s.resetWorld({ seed: 3, blockThemeId: 'default' });
      expect(await s.load()).toMatchObject({ animals: [], world: { seed: 3 } });
    });
  });
}
