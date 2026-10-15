import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import { FIRE_TILE, generateIsland, islandSide, islandTiles } from '../domain/island/island';
import { pickNewAnimalTile } from '../domain/island/level';
import { resolvePhase } from '../domain/timer/phase';
import type { PlacedAnimal } from '../domain/types';
import { createMemoryStorage } from '../platform/storage/memory';
import type { StorageAdapter } from '../platform/storage';
import { createAppStore, selectIslandLevel, selectVisibleAnimals } from './appStore';

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
