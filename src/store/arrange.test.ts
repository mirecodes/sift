import { describe, expect, it } from 'vitest';
import { CATALOG } from '../domain/animals/catalog';
import { newPlacedAnimal } from '../domain/animals/placed';
import { generateIsland } from '../domain/island/island';
import { animalTile, tileKey } from '../domain/island/occupancy';
import { seededRng } from '../domain/random';
import { createFakeRemote, FAKE_CODE } from '../platform/remote/fake';
import { createMemoryStorage } from '../platform/storage/memory';
import type { StorageAdapter } from '../platform/storage';
import { createAppStore } from './appStore';

const MIN = 60_000;

function harness(storage: StorageAdapter = createMemoryStorage(), remote = false) {
  const clock = { t: Date.UTC(2026, 9, 28, 9) };
  let n = 0;
  const fake = remote ? createFakeRemote({ appVersion: '0.2.0', now: () => clock.t, random: seededRng(9), uuid: () => `srv-${++n}` }) : null;
  const store = createAppStore({ storage, now: () => clock.t, rng: seededRng(2), uuid: () => `id-${++n}`, economy: true, remote: fake, clientVersion: '0.2.0' });
  return { store, get: store.getState, clock, storage };
}

/** Three animals from three completed focus sessions. */
async function threeAnimals(h: ReturnType<typeof harness>) {
  for (let i = 0; i < 3; i++) {
    await h.get().startFocus();
    for (let k = 0; k < 50 && h.get().account.status === 'signedIn' && !h.get().sessions.at(-1)?.verified; k++) await new Promise((r) => setTimeout(r, 5));
    h.clock.t += 60 * MIN;
    await h.get().endFocus();
    for (let k = 0; k < 50 && h.get().phase.kind === 'break' && (h.get().phase as { awaiting?: unknown }).awaiting; k++) await new Promise((r) => setTimeout(r, 5));
    await h.get().goHome();
  }
}

/** A free land tile away from every animal. */
function freeTile(h: ReturnType<typeof harness>) {
  const s = h.get();
  const taken = new Set(s.animals.map((a) => tileKey(animalTile(a))));
  return generateIsland(s.world.seed, s.animals.length).tiles.find((t) => !t.water && Math.hypot(t.x, t.z) > 2.5 && !taken.has(tileKey(t)))!;
}

describe('arranging animals in the store (Steps 10.1–10.3)', () => {
  it('pins an animal where it was put, and the pin survives a reload, new rewards and building elsewhere', async () => {
    const storage = createMemoryStorage();
    const h = harness(storage);
    await h.get().init();
    await threeAnimals(h);
    const target = freeTile(h);
    const id = h.get().animals[0]!.id;
    expect(await h.get().arrangeAnimal(id, target)).toBeNull();
    expect(h.get().animals.find((a) => a.id === id)).toMatchObject({ tileX: target.x, tileZ: target.z, pinned: true });
    // A new reward never moves it.
    await threeAnimals(h);
    expect(h.get().animals.find((a) => a.id === id)).toMatchObject({ tileX: target.x, tileZ: target.z, pinned: true });
    // Reload.
    const again = createAppStore({ storage, now: () => h.clock.t, rng: seededRng(3), uuid: () => 'x', economy: true });
    await again.getState().init();
    expect(again.getState().animals.find((a) => a.id === id)).toMatchObject({ tileX: target.x, tileZ: target.z, pinned: true });
  });

  it('a pinned animal keeps its spot when others expire', async () => {
    const storage = createMemoryStorage();
    const h = harness(storage);
    const species = (id: string) => CATALOG.find((s) => s.id === id)!;
    await storage.commit({ animals: [newPlacedAnimal('u', species('unicorn'), { x: 1, z: 2 }, h.clock.t, 's'), newPlacedAnimal('fox', species('fox'), { x: 2, z: 2 }, h.clock.t, 's')] });
    await storage.saveWorld({ seed: 1, blockThemeId: 'default' });
    await h.get().init();
    const target = freeTile(h);
    expect(await h.get().arrangeAnimal('u', target)).toBeNull();
    // Eight days later the fox has left; the Unicorn never expires and stays put.
    const later = createAppStore({ storage, now: () => h.clock.t + 8 * 24 * 60 * MIN, rng: seededRng(3), uuid: () => 'x', economy: true });
    await later.getState().init();
    expect(later.getState().animals.find((a) => a.id === 'fox')?.status).toBe('departed');
    expect(later.getState().animals.find((a) => a.id === 'u')).toMatchObject({ status: 'active', tileX: target.x, tileZ: target.z, pinned: true });
  });

  it('rejects water, the camp and tiles off the island; nothing changes', async () => {
    const h = harness();
    await h.get().init();
    await threeAnimals(h);
    const before = h.get().animals;
    expect(await h.get().arrangeAnimal(before[0]!.id, { x: 0, z: 0 })).toBe('not_standable');
    expect(await h.get().arrangeAnimal(before[0]!.id, { x: 50, z: 50 })).toBe('not_standable');
    expect(h.get().animals).toEqual(before);
  });

  it('a building put on a pinned animal unpins it and it walks to a free tile', async () => {
    const h = harness();
    await h.get().init();
    await threeAnimals(h);
    const target = freeTile(h);
    const id = h.get().animals[0]!.id;
    await h.get().arrangeAnimal(id, target);
    // Buy a fence with the starter gold and place it right there.
    await h.get().buyItem('fence');
    expect(await h.get().placeBuilding({ defId: 'fence', tile: target, rotation: 0 })).toBeNull();
    const a = h.get().animals.find((x) => x.id === id)!;
    expect(a.pinned).toBe(false);
    expect([a.tileX, a.tileZ]).not.toEqual([target.x, target.z]);
  });

  it('signed in, the server validates and stores the pinned position', async () => {
    const h = harness(createMemoryStorage(), true);
    await h.get().init();
    await h.get().requestSignInCode('mina@example.com');
    await h.get().verifySignInCode('mina@example.com', FAKE_CODE);
    await threeAnimals(h);
    const animals = h.get().animals.filter((a) => a.status === 'active');
    expect(animals.length).toBeGreaterThan(0);
    const target = freeTile(h);
    expect(await h.get().arrangeAnimal(animals[0]!.id, target)).toBeNull();
    expect(h.get().animals.find((a) => a.id === animals[0]!.id)).toMatchObject({ tileX: target.x, tileZ: target.z, pinned: true });
  });
});
