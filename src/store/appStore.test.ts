import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import { FIRE_TILE, generateIsland, islandSide, islandTiles } from '../domain/island/island';
import { pickNewAnimalTile } from '../domain/island/level';
import { resolvePhase } from '../domain/timer/phase';
import type { PlacedAnimal } from '../domain/types';
import { createMemoryStorage } from '../platform/storage/memory';
import type { StorageAdapter } from '../platform/storage';
import { suggestTile } from '../domain/build/placement';
import { createAppStore, EquipError, selectOccupancy, selectActiveUnicorns, selectCurrentNotice, selectIslandLevel, selectShownGold, selectVisibleAnimals } from './appStore';
import { InsufficientGoldError } from '../domain/economy/ledger';
import { CATALOG } from '../domain/animals/catalog';
import { newPlacedAnimal } from '../domain/animals/placed';

const MIN = 60_000;

function harness(storage: StorageAdapter = createMemoryStorage(), seed = 1) {
  const clock = { t: 1_000_000 };
  let n = 0;
  const store = createAppStore({
    storage,
    now: () => clock.t,
    rng: seededRng(seed),
    uuid: () => `id-${++n}`,
  });
  return { store, clock, storage, get: store.getState };
}

describe('focus cycle', () => {
  it('runs focus -> overtime -> break with a reward after 25+ minutes', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    expect(h.get().phase.kind).toBe('focus');
    expect(h.get().sessions).toHaveLength(1);

    h.clock.t += 24 * MIN;
    await h.get().endFocus(); // not overtime yet: ignored
    expect(h.get().phase.kind).toBe('focus');

    h.clock.t += 6 * MIN; // 30 min effective, 5 min overtime
    expect(resolvePhase(h.get().phase, h.clock.t).kind).toBe('focusOvertime');
    await h.get().endFocus();

    const s = h.get();
    expect(s.phase.kind).toBe('break');
    expect(s.animals).toHaveLength(1);
    expect(s.phase.kind === 'break' && s.phase.rewardId).toBe(s.animals[0]?.id);
    expect(s.sessions[0]).toMatchObject({ status: 'completed', effectiveFocusMs: 30 * MIN, rewardAnimalId: s.animals[0]?.id });
    expect(s.revealPending).toBe(s.animals[0]?.id);
    expect(selectVisibleAnimals(s)).toHaveLength(0);
    expect(selectIslandLevel(s)).toBe(0);
  });

  it('gives no reward below 25 effective minutes', async () => {
    const h = harness();
    await h.get().init();
    await h.get().updateSettings({ focusMinutes: 10 });
    await h.get().startFocus();
    h.clock.t += 12 * MIN;
    await h.get().endFocus();
    expect(h.get().animals).toHaveLength(0);
    expect(h.get().phase).toMatchObject({ kind: 'break' });
    expect(h.get().phase.kind === 'break' && h.get().phase).not.toHaveProperty('rewardId');
    expect(h.get().sessions[0]?.rewardAnimalId).toBeUndefined();
  });

  it('caps effective focus time at 60 minutes', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    h.clock.t += 5 * 60 * MIN;
    await h.get().endFocus();
    expect(h.get().sessions[0]?.effectiveFocusMs).toBe(60 * MIN);
  });

  it('abandoning gives no reward and returns to idle; it is not allowed in overtime', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    h.clock.t += 26 * MIN;
    await h.get().abandonFocus(); // overtime: ignored
    expect(h.get().phase.kind).toBe('focus');

    const h2 = harness();
    await h2.get().init();
    await h2.get().startFocus();
    h2.clock.t += 5 * MIN;
    await h2.get().abandonFocus();
    expect(h2.get().phase.kind).toBe('idle');
    expect(h2.get().animals).toHaveLength(0);
    expect(h2.get().sessions[0]?.status).toBe('abandoned');
  });

  it('places animals on distinct tiles that exist in the current island', async () => {
    const h = harness(createMemoryStorage(), 5);
    await h.get().init();
    for (let i = 0; i < 40; i++) {
      await h.get().startFocus();
      h.clock.t += 61 * MIN;
      await h.get().endFocus();
      await h.get().goHome();
    }
    const { animals, world } = h.get();
    expect(animals).toHaveLength(40);
    expect(new Set(animals.map((a) => `${a.tileX},${a.tileZ}`)).size).toBe(40);
    const side = islandSide(40);
    const tiles = new Set(islandTiles(world.seed, side).map((t) => `${t.x},${t.z}`));
    for (const a of animals) expect(tiles.has(`${a.tileX},${a.tileZ}`)).toBe(true);
  });

  it('start focus from the break skips the reveal and starts a fresh session', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    h.clock.t += 30 * MIN;
    await h.get().endFocus();
    await h.get().startFocus();
    expect(h.get().phase.kind).toBe('focus');
    expect(h.get().revealPending).toBeNull();
    expect(h.get().sessions).toHaveLength(2);
    expect(selectIslandLevel(h.get())).toBe(1);
  });

  it('holds the island size back during the break, then grows on Home', async () => {
    const h = harness();
    await h.get().init();
    for (let i = 0; i < 17; i++) {
      await h.get().startFocus();
      h.clock.t += 30 * MIN;
      await h.get().endFocus();
      if (i < 16) await h.get().goHome();
    }
    expect(h.get().animals).toHaveLength(17);
    expect(islandSide(selectIslandLevel(h.get()))).toBe(7);
    await h.get().goHome();
    expect(islandSide(selectIslandLevel(h.get()))).toBe(9);
  });
});

describe('tabs (Step 1.1)', () => {
  it('switching tabs never touches the timer, and Focus always runs on Island', async () => {
    const h = harness();
    await h.get().init();
    h.get().setTab('stats');
    expect(h.get().activeTab).toBe('stats');
    await h.get().startFocus();
    expect(h.get().activeTab).toBe('island');
    const phase = h.get().phase;
    h.get().setTab('stats'); // tab bar is hidden during Focus: ignored
    expect(h.get().activeTab).toBe('island');
    expect(h.get().phase).toBe(phase);
  });

  it('leaving Island during a break keeps the break and ends the reveal', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    h.clock.t += 30 * MIN;
    await h.get().endFocus();
    const phase = h.get().phase;
    expect(h.get().revealPending).not.toBeNull();
    h.get().setTab('stats');
    expect(h.get().phase).toBe(phase);
    expect(h.get().revealPending).toBeNull();
    h.get().setTab('island');
    expect(h.get().phase).toBe(phase);
  });
});

describe('inbox (Step 0.9)', () => {
  const departed = (gold: number) => ({ kind: 'animals_departed' as const, animalIds: ['x'], gold });

  it('notices queued during Focus are held back and show after Focus ends', async () => {
    const h = harness();
    await h.get().init();
    await h.get().startFocus();
    await h.get().enqueueNotice(departed(3));
    h.clock.t += 1;
    await h.get().enqueueNotice(departed(5));
    expect(h.get().inbox).toHaveLength(2);
    expect(selectCurrentNotice(h.get())).toBeUndefined();

    // Nothing is dequeued during Focus, even if asked.
    await h.get().dismissNotice(h.get().inbox[0]!.id);
    expect(h.get().inbox).toHaveLength(2);

    h.clock.t += 30 * MIN; // overtime is still Focus
    expect(selectCurrentNotice(h.get())).toBeUndefined();
    await h.get().endFocus();
    expect(h.get().phase.kind).toBe('break');
    const first = selectCurrentNotice(h.get())!;
    expect(first.notice).toEqual(departed(3));

    await h.get().dismissNotice(first.id);
    await h.get().goHome();
    expect(selectCurrentNotice(h.get())?.notice).toEqual(departed(5));
  });

  it('survives a reload and dismissals are saved', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().enqueueNotice(departed(1));
    await a.get().enqueueNotice(departed(2));
    await a.get().dismissNotice(selectCurrentNotice(a.get())!.id);

    const b = harness(storage);
    await b.get().init();
    expect(b.get().inbox.map((n) => n.notice)).toEqual([departed(2)]);
    expect(selectCurrentNotice(b.get())?.notice).toEqual(departed(2));
  });

  it('a reload into Focus still holds notices back', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().startFocus();
    await a.get().enqueueNotice(departed(1));

    const b = harness(storage);
    await b.get().init();
    expect(b.get().phase.kind).toBe('focus');
    expect(b.get().inbox).toHaveLength(1);
    expect(selectCurrentNotice(b.get())).toBeUndefined();
  });
});

describe('save repair on load (Step 0.7)', () => {
  it('moves animals off the camp and saves the new positions', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().startFocus();
    a.clock.t += 30 * MIN;
    await a.get().endFocus();
    await a.get().goHome();
    const earned = a.get().animals[0]!;
    await storage.commit({ animal: { ...earned, tileX: FIRE_TILE.x, tileZ: FIRE_TILE.z } }); // an old save on the campfire

    const b = harness(storage);
    await b.get().init();
    const fixed = b.get().animals[0]!;
    expect([fixed.tileX, fixed.tileZ]).not.toEqual([FIRE_TILE.x, FIRE_TILE.z]);
    expect((await storage.load()).animals[0]).toEqual(fixed);

    const c = harness(storage);
    await c.get().init();
    expect(c.get().animals[0]).toEqual(fixed); // idempotent across loads
  });
});

describe('monotonic island level (ADR-032)', () => {
  async function earn(n: number) {
    const h = harness();
    await h.get().init();
    for (let i = 0; i < n; i++) {
      await h.get().startFocus();
      h.clock.t += 30 * MIN;
      await h.get().endFocus();
      await h.get().goHome();
    }
    return h;
  }
  const depart = (a: PlacedAnimal): PlacedAnimal => ({ ...a, status: 'departed', endedAt: 1, endReason: 'expired' });

  it('departed animals never change the generated terrain', async () => {
    const h = await earn(20);
    const { animals, world, phase } = h.get();
    const before = generateIsland(world.seed, selectIslandLevel({ animals, phase }));
    for (const k of [1, 5, 20]) {
      const after = animals.map((a, i) => (i < k ? depart(a) : a));
      expect(selectIslandLevel({ animals: after, phase })).toBe(20);
      expect(generateIsland(world.seed, selectIslandLevel({ animals: after, phase }))).toEqual(before);
    }
  });

  it('the same save produces the same island as before the change (level = animal count when all are active)', async () => {
    const h = await earn(18);
    const { animals, world, phase } = h.get();
    expect(selectIslandLevel(h.get())).toBe(animals.length);
    expect(generateIsland(world.seed, selectIslandLevel({ animals, phase }))).toEqual(generateIsland(world.seed, animals.length));
  });

  it('only active animals are drawn and occupy tiles', async () => {
    const h = await earn(3);
    const [gone, ...rest] = h.get().animals;
    h.store.setState({ animals: [depart(gone!), ...rest] });
    expect(selectVisibleAnimals(h.get()).map((a) => a.id)).toEqual(rest.map((a) => a.id));
    // The departed animal's tile is free again; an active animal's tile never is.
    const { seed } = h.get().world;
    const onTile = (animals: PlacedAnimal[]) => {
      const rng = seededRng(3);
      return Array.from({ length: 2000 }, () => pickNewAnimalTile(seed, animals, rng)).some((t) => t?.x === gone!.tileX && t?.z === gone!.tileZ);
    };
    expect(onTile([depart(gone!), ...rest])).toBe(true);
    expect(onTile([gone!, ...rest])).toBe(false);
  });
});

describe('persistence', () => {
  it('restores an in-progress focus after a reload', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().updateSettings({ focusMinutes: 40, soundEnabled: false });
    await a.get().startFocus();
    const seed = a.get().world.seed;

    const b = harness(storage);
    b.clock.t = a.clock.t + 41 * MIN;
    await b.get().init();
    expect(b.get().phase).toEqual(a.get().phase);
    expect(b.get().world.seed).toBe(seed);
    expect(b.get().settings).toMatchObject({ focusMinutes: 40, soundEnabled: false });
    expect(resolvePhase(b.get().phase, b.clock.t).kind).toBe('focusOvertime');
    await b.get().endFocus();
    expect(b.get().animals).toHaveLength(1);
  });

  it('dummy data shows in memory only: never saved, exported, or re-added after an import', async () => {
    const storage = createMemoryStorage();
    const session = { id: 'd1', startedAt: 1, plannedFocusMs: 25 * MIN, endedAt: 1 + 30 * MIN, status: 'completed' as const, togetherRoomId: null };
    const inbox = [{ id: 'dn', createdAt: 1, notice: { kind: 'friend_request' as const, userId: 'u' } }];
    const a = createAppStore({ storage, now: () => 1_000_000, rng: seededRng(1), uuid: () => 'x', dummy: { sessions: [session], inbox } });
    await a.getState().init();
    expect(a.getState().sessions).toContainEqual(session);
    expect(a.getState().inbox).toEqual(inbox);
    const backup = await a.getState().exportBackup();
    expect(backup.data.sessions ?? []).toHaveLength(0);
    expect(backup.data.inbox ?? []).toHaveLength(0);
    await a.getState().importBackup(backup);
    expect(a.getState().sessions).toHaveLength(0);
    const reloaded = createAppStore({ storage, now: () => 1_000_000, rng: seededRng(1), uuid: () => 'x' });
    await reloaded.getState().init();
    expect(reloaded.getState().sessions).toHaveLength(0);
  });

  it('resetMap starts with a new seed and no animals, and persists that', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().startFocus();
    a.clock.t += 30 * MIN;
    await a.get().endFocus();
    expect(a.get().animals).toHaveLength(1);

    const b = createAppStore({ storage, now: () => a.clock.t, rng: seededRng(99), uuid: () => 'x', resetMap: true });
    await b.getState().init();
    expect(b.getState().animals).toHaveLength(0);
    expect(b.getState().world.seed).not.toBe(a.get().world.seed);
    expect(b.getState().sessions).toHaveLength(1);

    const c = harness(storage);
    await c.get().init();
    expect(c.get().animals).toHaveLength(0);
    expect(c.get().world.seed).toBe(b.getState().world.seed);
  });

  it('restores a break with a pending reveal', async () => {
    const storage = createMemoryStorage();
    const a = harness(storage);
    await a.get().init();
    await a.get().startFocus();
    a.clock.t += 30 * MIN;
    await a.get().endFocus();

    const b = harness(storage);
    await b.get().init();
    expect(b.get().phase.kind).toBe('break');
    expect(b.get().revealPending).toBe(a.get().animals[0]?.id);
  });

  it('sanitizes out-of-range settings', async () => {
    const h = harness();
    await h.get().init();
    await h.get().updateSettings({ focusMinutes: 500, breakMinutes: 0 });
    expect(h.get().settings).toMatchObject({ focusMinutes: 60, breakMinutes: 1 });
  });

  it('week start defaults to Monday, saves Sunday, and rejects other values (Step 1.7)', async () => {
    const storage = createMemoryStorage();
    const h = harness(storage);
    await h.get().init();
    expect(h.get().settings.weekStartsOn).toBe(1);
    await h.get().updateSettings({ weekStartsOn: 0 });
    const again = harness(storage);
    await again.get().init();
    expect(again.get().settings.weekStartsOn).toBe(0);
    await again.get().updateSettings({ weekStartsOn: 5 as 0 });
    expect(again.get().settings.weekStartsOn).toBe(1);
  });

  it('falls back to memory when storage fails', async () => {
    const broken: StorageAdapter = {
      schemaVersion: 3,
      load: () => Promise.reject(new Error('blocked')),
      exportAll: () => Promise.reject(new Error('blocked')),
      importAll: () => Promise.reject(new Error('blocked')),
      saveSettings: () => Promise.reject(new Error('blocked')),
      saveWorld: () => Promise.reject(new Error('blocked')),
      resetWorld: () => Promise.reject(new Error('blocked')),
      commit: () => Promise.reject(new Error('blocked')),
    };
    const h = harness(broken);
    await h.get().init();
    await h.get().startFocus();
    expect(h.get().phase.kind).toBe('focus');
  });
});

describe('wallet (Step 2.1)', () => {
  const fence = { id: 'c1', kind: 'building' as const, defId: 'fence', acquiredAt: 0, source: 'shop' };
  const economy = (storage: StorageAdapter = createMemoryStorage()) => {
    let n = 0;
    return createAppStore({ storage, now: () => 5, rng: seededRng(1), uuid: () => `w-${++n}`, economy: true });
  };

  it('grants the starter gold once per save, and only with the economy on', async () => {
    const storage = createMemoryStorage();
    const off = harness(storage);
    await off.get().init();
    expect(off.get().gold).toBe(0);

    const a = economy(storage);
    await a.getState().init();
    expect(a.getState().gold).toBe(30);
    const b = economy(storage);
    await b.getState().init();
    expect(b.getState().gold).toBe(30);
    expect((await storage.load()).ledger).toHaveLength(1);
  });

  it('spending writes the debit and the item together and recomputes on load', async () => {
    const storage = createMemoryStorage();
    const s = economy(storage);
    await s.getState().init();
    await s.getState().spendGold(10, 'purchase', 'fence', fence);
    expect(s.getState().gold).toBe(20);
    const rows = await storage.exportAll();
    expect(rows.cosmetics).toEqual([fence]);
    const again = economy(storage);
    await again.getState().init();
    expect(again.getState().gold).toBe(20);
  });

  it('a short balance rejects with a typed error and changes nothing', async () => {
    const storage = createMemoryStorage();
    const s = economy(storage);
    await s.getState().init();
    await expect(s.getState().spendGold(31, 'purchase', 'fence', fence)).rejects.toBeInstanceOf(InsufficientGoldError);
    expect(s.getState().gold).toBe(30);
    const rows = await storage.exportAll();
    expect(rows.ledger).toHaveLength(1);
    expect(rows.cosmetics).toEqual([]);
  });

  it('a failed write changes neither the balance nor the stored rows', async () => {
    const storage = createMemoryStorage();
    const s = economy(storage);
    await s.getState().init();
    const failing: StorageAdapter = { ...storage, commit: () => Promise.reject(new Error('disk full')) };
    const t = createAppStore({ storage: failing, now: () => 5, rng: seededRng(1), uuid: () => 'z', economy: true });
    await t.getState().init();
    await expect(t.getState().spendGold(10, 'purchase', 'fence', fence)).rejects.toThrow('disk full');
    expect(t.getState().gold).toBe(30);
    expect((await storage.exportAll()).ledger).toHaveLength(1);
  });
});

describe('inventory and equip (Step 3.7)', () => {
  const shop = (storage: StorageAdapter = createMemoryStorage(), dummy?: Parameters<typeof createAppStore>[0]['dummy']) => {
    let n = 0;
    const s = createAppStore({ storage, now: () => Date.parse('2026-10-10'), rng: seededRng(1), uuid: () => `i-${++n}`, economy: true, clientVersion: '0.1.0', ...(dummy && { dummy }) });
    return s;
  };
  /** A save with 200 gold and a fox and a tiger earned yesterday (so they do not depart). */
  async function seeded() {
    const storage = createMemoryStorage();
    const earned = Date.parse('2026-10-09');
    await storage.commit({
      ledgerAdd: [{ id: 'g', at: 0, currency: 'gold', amount: 200, reason: 'starter', refId: null }],
      animals: [newPlacedAnimal('fox1', CATALOG.find((c) => c.id === 'fox')!, { x: 1, z: 1 }, earned, 's'), newPlacedAnimal('t1', CATALOG.find((c) => c.id === 'tiger')!, { x: 2, z: 1 }, earned, 's')],
    });
    return storage;
  }

  it('buying writes the debit and one item; skins once, buildings many times', async () => {
    const storage = await seeded();
    const s = shop(storage);
    await s.getState().init();
    await s.getState().buyItem('golden:fox');
    expect(s.getState().gold).toBe(200 - 45);
    expect(s.getState().cosmetics.map((c) => c.defId)).toEqual(['golden:fox']);
    await expect(s.getState().buyItem('golden:fox')).rejects.toMatchObject({ problem: 'owned' });
    await s.getState().buyItem('lantern');
    await s.getState().buyItem('lantern');
    expect(s.getState().cosmetics.filter((c) => c.defId === 'lantern')).toHaveLength(2);
    expect(s.getState().gold).toBe(200 - 45 - 50);
    const rows = await storage.exportAll();
    expect(rows.cosmetics).toHaveLength(3);
    expect((rows.ledger as { amount: number }[]).reduce((a, e) => a + e.amount, 0)).toBe(105);
  });

  it('refuses skins of species not found yet, unsold items and short balances, changing nothing', async () => {
    const s = shop(await seeded());
    await s.getState().init();
    await expect(s.getState().buyItem('golden:panda')).rejects.toMatchObject({ problem: 'species_not_found' });
    await expect(s.getState().buyItem('champion-flag')).rejects.toMatchObject({ problem: 'not_for_sale' });
    await s.getState().buyItem('cherry');
    await expect(s.getState().buyItem('windmill')).rejects.toBeInstanceOf(InsufficientGoldError);
    expect(s.getState().gold).toBe(0);
    expect(s.getState().cosmetics.map((c) => c.defId)).toEqual(['cherry']);
  });

  it('equips owned skins and themes, keeps them after a reload and refuses the rest', async () => {
    const storage = await seeded();
    const s = shop(storage);
    await s.getState().init();
    await s.getState().buyItem('white-tiger');
    await s.getState().buyItem('desert');
    await s.getState().equipSkin('tiger', 'white-tiger');
    await s.getState().equipTheme('desert');
    await expect(s.getState().equipSkin('fox', 'golden:fox')).rejects.toMatchObject({ problem: 'not_owned' });
    await expect(s.getState().equipTheme('snow')).rejects.toBeInstanceOf(EquipError);
    expect(s.getState().equipped).toEqual({ skinsBySpecies: { tiger: ['white-tiger'] }, blockThemeId: 'desert' });
    const again = shop(storage);
    await again.getState().init();
    expect(again.getState().equipped).toEqual({ skinsBySpecies: { tiger: ['white-tiger'] }, blockThemeId: 'desert' });
    await again.getState().equipSkin('tiger', 'default');
    expect(again.getState().equipped.skinsBySpecies).toEqual({});
  });

  it('chooses, toggles and adds skins in a species choice, saved (ADR-043)', async () => {
    const storage = await seeded();
    const s = shop(storage);
    await s.getState().init();
    await s.getState().buyItem('white-tiger');
    await s.getState().chooseSkins('tiger', ['white-tiger', 'default']);
    expect(s.getState().equipped.skinsBySpecies.tiger).toEqual(['white-tiger', 'default']);
    await s.getState().toggleSkin('tiger', 'default');
    expect(s.getState().equipped.skinsBySpecies.tiger).toEqual(['white-tiger']);
    await s.getState().addSkin('tiger', 'default');
    expect(s.getState().equipped.skinsBySpecies.tiger).toEqual(['white-tiger', 'default']);
    expect(((await storage.load()).equipped as { skinsBySpecies: Record<string, string[]> }).skinsBySpecies.tiger).toEqual(['white-tiger', 'default']);
  });

  it('a reward animal of a species with several chosen skins arrives in one of them', async () => {
    // Choose two skins for every species the seeded roll could give, then earn one animal.
    const storage = createMemoryStorage();
    const all = CATALOG.map((c) => c.id);
    await storage.commit({ cosmeticsAdd: all.map((id, i) => ({ id: `g${i}`, kind: 'animalSkin' as const, defId: `golden:${id}`, acquiredAt: 0, source: 'shop' })) });
    const h = harness(storage);
    await h.get().init();
    for (const id of all) await h.get().chooseSkins(id, ['default', `golden:${id}`]);
    await h.get().startFocus();
    h.clock.t += 30 * MIN;
    await h.get().endFocus();
    const animal = h.get().animals[0]!;
    expect(['default', `golden:${animal.speciesId}`]).toContain(animal.skinId);
    expect((await storage.load()).animals[0]!.skinId).toBe(animal.skinId);
  });

  it('dummy items live in memory only: owned, equipped and placed, never stored', async () => {
    const storage = await seeded();
    const own = (defId: string, kind: 'building' | 'blockTheme', i = 0) => ({ id: `d-${defId}-${i}`, kind, defId, acquiredAt: 0, source: 'dummy' });
    const s = shop(storage, { sessions: [], inbox: [], cosmetics: [own('lantern', 'building'), own('fence', 'building'), own('snow', 'blockTheme')], equipped: { skinsBySpecies: {}, blockThemeId: 'snow' }, buildings: ['lantern'] });
    await s.getState().init();
    expect(s.getState().equipped.blockThemeId).toBe('snow');
    expect(s.getState().placedBuildings.map((b) => b.defId)).toEqual(['lantern']);
    const rows = await storage.exportAll();
    expect(rows.cosmetics).toEqual([]);
    expect(rows.placedBuildings).toEqual([]);
  });
});

describe('build mode (Step 3.11)', () => {
  async function owner(items: string[]) {
    const storage = createMemoryStorage();
    await storage.commit({
      cosmeticsAdd: items.map((defId, i) => ({ id: `c${i}`, kind: 'building' as const, defId, acquiredAt: 0, source: 'shop' })),
    });
    let n = 0;
    const s = createAppStore({ storage, now: () => 1000, rng: seededRng(3), uuid: () => `b-${++n}`, clientVersion: '0.1.0' });
    await s.getState().init();
    return { s, storage };
  }
  const spot = (s: ReturnType<typeof createAppStore>, defId: string) =>
    suggestTile(selectOccupancy(s.getState()), { defId, rotation: 0, minFreeTiles: 6 })!;

  it('places owned buildings, persists them and refuses when none are left or it does not fit', async () => {
    const { s, storage } = await owner(['lantern']);
    const tile = spot(s, 'lantern');
    expect(await s.getState().placeBuilding({ defId: 'lantern', tile, rotation: 0 })).toBeNull();
    expect(s.getState().placedBuildings).toMatchObject([{ defId: 'lantern', tileX: tile.x, tileZ: tile.z, rotation: 0 }]);
    expect((await storage.load()).placedBuildings).toHaveLength(1);
    expect(await s.getState().placeBuilding({ defId: 'lantern', tile, rotation: 0 })).toBe('none_left');
    const { s: s2 } = await owner(['fence']);
    expect(await s2.getState().placeBuilding({ defId: 'fence', tile: FIRE_TILE, rotation: 0 })).toBe('camp');
  });

  it('moves, rotates and stores a placed building', async () => {
    const { s, storage } = await owner(['windmill']);
    const tile = spot(s, 'windmill');
    await s.getState().placeBuilding({ defId: 'windmill', tile, rotation: 0 });
    const id = s.getState().placedBuildings[0]!.id;
    const grid = selectOccupancy(s.getState());
    const other = suggestTile(new Map([...grid].filter(([, t]) => t.x !== tile.x || t.z !== tile.z)), { defId: 'windmill', rotation: 0, minFreeTiles: 6, movingId: id })!;
    expect(await s.getState().placeBuilding({ defId: 'windmill', tile: other, rotation: 0, movingId: id })).toBeNull();
    expect(s.getState().placedBuildings).toMatchObject([{ id, tileX: other.x, tileZ: other.z }]);
    const turned = await s.getState().placeBuilding({ defId: 'windmill', tile: other, rotation: 90, movingId: id });
    if (turned === null) expect(s.getState().placedBuildings[0]!.rotation).toBe(90);
    await s.getState().storeBuilding(id);
    expect(s.getState().placedBuildings).toEqual([]);
    expect((await storage.load()).placedBuildings).toEqual([]);
  });

  it('animals on the tiles walk to the nearest free tile in the same write', async () => {
    const { s, storage } = await owner(['lantern']);
    await s.getState().startFocus();
    await s.getState().abandonFocus();
    // Put an animal where the lantern will go.
    const tile = spot(s, 'lantern');
    const fox = newPlacedAnimal('fox', CATALOG.find((c) => c.id === 'fox')!, tile, 1000, 's');
    await storage.commit({ animal: fox });
    let n = 0;
    const again = createAppStore({ storage, now: () => 1000, rng: seededRng(3), uuid: () => `x-${++n}`, clientVersion: '0.1.0' });
    await again.getState().init();
    expect(await again.getState().placeBuilding({ defId: 'lantern', tile, rotation: 0 })).toBeNull();
    const moved = again.getState().animals.find((a) => a.id === 'fox')!;
    expect([moved.tileX, moved.tileZ]).not.toEqual([tile.x, tile.z]);
    expect((await storage.load()).animals.find((a) => a.id === 'fox')).toMatchObject({ tileX: moved.tileX, tileZ: moved.tileZ });
  });

  it('builds only on Home', async () => {
    const { s } = await owner(['fence']);
    const tile = spot(s, 'fence');
    await s.getState().startFocus();
    expect(await s.getState().placeBuilding({ defId: 'fence', tile, rotation: 0 })).toBe('not_idle');
  });
});

describe('expiry (Step 2.2)', () => {
  const DAY = 24 * 60 * MIN;
  const species = (id: string) => CATALOG.find((s) => s.id === id)!;
  const stored = (id: string, speciesId: string, acquiredAt: number, tileX: number): PlacedAnimal => ({
    ...newPlacedAnimal(id, species(speciesId), { x: tileX, z: 2 }, acquiredAt, 's'),
  });
  async function setup(animals: PlacedAnimal[], now: number, economy = true) {
    const storage = createMemoryStorage();
    await storage.commit({ animals });
    await storage.saveWorld({ seed: 1, blockThemeId: 'default' });
    const clock = { t: now };
    let n = 0;
    const store = createAppStore({ storage, now: () => clock.t, rng: seededRng(1), uuid: () => `e-${++n}`, economy });
    await store.getState().init();
    return { store, storage, clock, get: store.getState };
  }
  const departures = (s: { inbox: { notice: { kind: string } }[] }) => s.inbox.filter((r) => r.notice.kind === 'animals_departed');

  it('departs at exactly 7 days with gold, a notice and the real expiry time, all in storage', async () => {
    const h = await setup([stored('fox', 'fox', 0, 1), stored('chick', 'chick', DAY, 2)], 7 * DAY);
    expect(h.get().animals.find((a) => a.id === 'fox')).toMatchObject({ status: 'departed', endedAt: 7 * DAY, endReason: 'expired' });
    expect(h.get().animals.find((a) => a.id === 'chick')?.status).toBe('active');
    expect(h.get().gold).toBe(30 + 8);
    expect(departures(h.get())[0]?.notice).toEqual({ kind: 'animals_departed', animalIds: ['fox'], gold: 8 });
    const saved = await h.storage.load();
    expect(saved.animals.find((a) => a.id === 'fox')?.status).toBe('departed');
    expect(saved.ledger.find((e) => e.reason === 'expiry')).toMatchObject({ amount: 8, refId: 'fox', at: 7 * DAY });
    expect(saved.inbox).toHaveLength(1);
  });

  it('never expires a Unicorn', async () => {
    const h = await setup([stored('u', 'unicorn', 0, 1)], 365 * DAY);
    expect(h.get().animals[0]?.status).toBe('active');
    expect(departures(h.get())).toHaveLength(0);
  });

  it('a long absence departs many at once in one notice', async () => {
    const list = ['chick', 'rabbit', 'duck', 'sheep', 'tiger'].map((id, i) => stored(id, id, i * DAY, i - 2));
    const h = await setup(list, 60 * DAY);
    expect(h.get().animals.every((a) => a.status === 'departed')).toBe(true);
    expect(departures(h.get())).toHaveLength(1);
    expect(h.get().gold).toBe(30 + 1 + 1 + 1 + 3 + 25);
  });

  it('is idempotent: running again gives the gold once', async () => {
    const h = await setup([stored('fox', 'fox', 0, 1)], 8 * DAY);
    await h.get().applyExpirations();
    await Promise.all([h.get().applyExpirations(), h.get().applyExpirations()]);
    expect(h.get().gold).toBe(38);
    expect((await h.storage.load()).ledger.filter((e) => e.reason === 'expiry')).toHaveLength(1);
    expect(departures(h.get())).toHaveLength(1);
  });

  it('nothing departs while focusing; it happens when Focus ends', async () => {
    const h = await setup([stored('fox', 'fox', 0, 1)], 7 * DAY - 10 * MIN);
    await h.get().startFocus();
    h.clock.t += 20 * MIN; // expired mid-focus
    await h.get().applyExpirations();
    expect(h.get().animals[0]?.status).toBe('active');
    expect(h.get().gold).toBe(30);
    h.clock.t += 10 * MIN;
    await h.get().endFocus();
    expect(h.get().animals[0]).toMatchObject({ status: 'departed', endedAt: 7 * DAY });
    expect(h.get().gold).toBe(38);
  });

  it('runs on the way Home and does nothing with the economy off', async () => {
    // Expires one minute after Focus ends, during the break.
    const h = await setup([stored('fox', 'fox', 0, 1)], 7 * DAY - 31 * MIN);
    await h.get().startFocus();
    h.clock.t += 30 * MIN;
    await h.get().endFocus();
    expect(h.get().animals[0]?.status).toBe('active');
    h.clock.t += 2 * MIN; // no timer tick in the store: the Home transition applies it
    await h.get().goHome();
    expect(h.get().animals[0]?.status).toBe('departed');

    const a = await setup([stored('cat', 'cat', 0, 1)], 7 * DAY - 2 * MIN);
    await a.get().startFocus();
    a.clock.t += 3 * MIN;
    await a.get().abandonFocus();
    expect(a.get().animals[0]?.status).toBe('departed');

    const off = await setup([stored('fox', 'fox', 0, 1)], 30 * DAY, false);
    await off.get().applyExpirations();
    expect(off.get().animals[0]?.status).toBe('active');
    expect(off.get().gold).toBe(0);
  });

  it('HUD: shown gold holds departure gold back until its notice shows; unicorns count active ones (Step 2.5)', async () => {
    const friend = { id: 'f', createdAt: 0, notice: { kind: 'friend_request' as const, userId: 'u' } };
    const h = await setup([stored('fox', 'fox', 0, 1), stored('u1', 'unicorn', 0, 2), { ...stored('u2', 'unicorn', 0, 0), status: 'spent' }], 8 * DAY);
    expect(selectActiveUnicorns(h.get())).toBe(1);
    expect(selectShownGold(h.get())).toBe(38); // the departure notice is the current one
    h.store.setState({ inbox: [friend, ...h.get().inbox] });
    expect(selectShownGold(h.get())).toBe(30); // an older notice is in front
    await h.get().dismissNotice('f');
    expect(selectShownGold(h.get())).toBe(38);
  });

  it('memory-only animals depart in memory and never reach storage', async () => {
    const storage = createMemoryStorage();
    const store = createAppStore({
      storage, now: () => 10 * DAY, rng: seededRng(1), uuid: (() => { let n = 0; return () => `m-${++n}`; })(), economy: true,
      dummy: { sessions: [], inbox: [], animals: [{ species: species('fox'), acquiredAt: 0 }] },
    });
    await store.getState().init();
    expect(store.getState().animals[0]?.status).toBe('departed');
    expect(store.getState().gold).toBe(38);
    const saved = await storage.load();
    expect(saved.animals).toEqual([]);
    expect(saved.ledger.map((e) => e.reason)).toEqual(['starter']);
    expect(saved.inbox).toEqual([]);
  });
});

describe('backup', () => {
  async function earnOne(h: ReturnType<typeof harness>) {
    await h.get().init();
    await h.get().updateSettings({ focusMinutes: 30, theme: 'dark' });
    await h.get().startFocus();
    h.clock.t += 31 * MIN;
    await h.get().endFocus();
    await h.get().goHome();
  }

  it('export then import into empty storage restores island, sessions and settings exactly', async () => {
    const a = harness();
    await earnOne(a);
    const backup = await a.get().exportBackup();

    const b = harness(createMemoryStorage(), 99);
    await b.get().init();
    await b.get().importBackup(backup);
    for (const key of ['world', 'animals', 'sessions', 'settings', 'phase'] as const) expect(b.get()[key]).toEqual(a.get()[key]);
    expect(await b.storage.exportAll()).toEqual(backup.data);
  });

  it('import replaces existing data instead of merging', async () => {
    const a = harness();
    await a.get().init();
    const empty = await a.get().exportBackup();

    const b = harness();
    await earnOne(b);
    await b.get().importBackup(empty);
    expect(b.get().animals).toEqual([]);
    expect(b.get().sessions).toEqual([]);
    expect(b.get().world).toEqual(a.get().world);
  });
});
