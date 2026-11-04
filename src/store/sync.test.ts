import { describe, expect, it } from 'vitest';
import type { SyncDelta, SyncRows } from '../../shared/api/types';
import { getSpecies } from '../domain/animals/catalog';
import { newPlacedAnimal } from '../domain/animals/placed';
import { applyDelta, backupFromRows, mergeById, type SyncedState } from './sync';

const empty: SyncRows = { animals: [], ledger: [], cosmetics: [], placedBuildings: [], sessions: [], islandHistory: [], notices: [] };
const state = (over: Partial<SyncedState> = {}): SyncedState => ({
  world: { seed: 1, blockThemeId: 'default' },
  animals: [],
  sessions: [],
  cosmetics: [],
  equipped: { skinsBySpecies: {}, blockThemeId: 'default' },
  placedBuildings: [],
  islandHistory: [],
  inbox: [],
  gold: 30,
  ...over,
});
const link = { userId: 'u', email: null, seq: 3, outbox: [], pendingEnds: [] };
const fox = newPlacedAnimal('fox', getSpecies('fox'), { x: 1, z: 1 }, 0, 's');

describe('delta sync on the client (Step 5.6)', () => {
  it('merges rows by id and keeps the order', () => {
    expect(mergeById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'b', v: 2 }, { id: 'c', v: 1 }])).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }]);
  });

  it('applies animals, gold, buildings, notices and the island, and moves the cursor', () => {
    const delta: SyncDelta = {
      seq: 9,
      rows: {
        ...empty,
        animals: [{ ...fox, status: 'departed' }],
        ledger: [
          { id: 'l1', at: 1, currency: 'gold', amount: 8, reason: 'expiry', refId: 'fox' },
          { id: 'old', at: 0, currency: 'gold', amount: 30, reason: 'starter', refId: null },
        ],
        placedBuildings: [{ id: 'b1', defId: 'fence', tileX: 1, tileZ: 2, rotation: 0, placedAt: 1 }, { id: 'b0', defId: 'well', tileX: 0, tileZ: 2, rotation: 0, placedAt: 1, deleted: true }],
        notices: [
          { id: 'n1', createdAt: 5, notice: { kind: 'animals_departed', animalIds: ['fox'], gold: 8 } },
          { id: 'n0', createdAt: 1, notice: { kind: 'friend_request', userId: 'x' }, dismissed: true },
          { id: 'n2', createdAt: 6, notice: { kind: 'friend_request', userId: 'y' } },
        ],
        island: { seed: 77, blockThemeId: 'snow', championWeek: '2026-W43' },
      },
    };
    const before = state({
      animals: [fox],
      placedBuildings: [{ id: 'b0', defId: 'well', tileX: 0, tileZ: 2, rotation: 0, placedAt: 0 }],
      inbox: [{ id: 'n0', createdAt: 1, notice: { kind: 'friend_request', userId: 'x' } }],
    });
    const out = applyDelta(before, delta, { ledger: new Set(['old']), dismissed: new Set(['n2']) }, link);
    expect(out.next.animals).toEqual([{ ...fox, status: 'departed' }]);
    expect(out.next.gold).toBe(38);
    expect(out.next.placedBuildings.map((b) => b.id)).toEqual(['b1']);
    expect(out.next.inbox.map((n) => n.id)).toEqual(['n1']); // n0 dismissed elsewhere, n2 already dismissed here
    expect(out.next.world).toEqual({ seed: 77, blockThemeId: 'snow' });
    expect(out.championWeek).toBe('2026-W43');
    expect(out.link.seq).toBe(9);
    expect(out.commit).toMatchObject({ ledgerSync: [{ id: 'l1' }], buildingsRemove: ['b0'], inboxRemove: ['n0'], world: { seed: 77 }, account: { seq: 9 } });
  });

  it('never moves the cursor back (an old replayed answer)', () => {
    expect(applyDelta(state(), { seq: 1, rows: empty }, { ledger: new Set(), dismissed: new Set() }, link).link.seq).toBe(3);
  });

  it('rebuilds the local stores from a full pull, keeping device settings', () => {
    const data = backupFromRows(
      { ...empty, animals: [fox], placedBuildings: [{ id: 'b', defId: 'fence', tileX: 1, tileZ: 1, rotation: 0, placedAt: 0, deleted: true }], island: { seed: 5, blockThemeId: 'autumn' } },
      { kv: [{ key: 'settings', value: { focusMinutes: 30 } }, { key: 'phase', value: {} }], contentPacks: [{ contentVersion: '1' }] },
      link,
    );
    expect(data.kv).toEqual([{ key: 'settings', value: { focusMinutes: 30 } }, { key: 'world', value: { seed: 5, blockThemeId: 'autumn' } }, { key: 'account', value: link }]);
    expect(data.animals).toEqual([fox]);
    expect(data.placedBuildings).toEqual([]);
    expect(data.contentPacks).toEqual([{ contentVersion: '1' }]);
  });
});
