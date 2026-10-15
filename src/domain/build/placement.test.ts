import { beforeAll, describe, expect, it } from 'vitest';
import type { BuildingDef } from '../../../shared/content/schema';
import { content } from '../content';
import { baselinePack } from '../content/baseline';
import { CAMP_RESERVED, islandSide, islandTiles } from '../island/island';
import { footprintTiles, getOccupancy, isFreeForAnimal, tileKey, type TileInfo } from '../island/occupancy';
import { placementProblem } from './placement';

const def = (id: string, w: number, d: number, extra: Partial<BuildingDef> = {}): BuildingDef => ({
  kind: 'building', id, name: { en: id, ko: id }, purchasable: true, price: 10, release: 'base', category: 'decor',
  footprint: { w, d }, model: 'species/chick', rotatable: true, ...extra,
});

beforeAll(() => {
  // Test buildings on top of the baseline (a newer pack wins).
  content.merge({ ...baselinePack, contentVersion: `${baselinePack.contentVersion}.99`, items: [...baselinePack.items, def('t-post', 1, 1), def('t-long', 2, 1), def('t-big', 3, 3), def('t-bridge', 1, 1, { allowOnWater: true })] });
});

const SEED = Array.from({ length: 80 }, (_, i) => i + 1).find((s) => islandTiles(s, islandSide(20)).some((t) => t.water))!;
const LEVEL = 20;
const grid = (buildings: Parameters<typeof getOccupancy>[0]['buildings'] = []) => getOccupancy({ seed: SEED, islandLevel: LEVEL, animals: [{ id: 'a', tile: { x: 2, z: 2 } }], buildings });
const flatPair = (g: Map<string, TileInfo>) =>
  [...g.values()].find((t) => {
    const n = g.get(tileKey({ x: t.x + 1, z: t.z }));
    return n && !t.water && !n.water && !t.campReserved && !n.campReserved && n.height === t.height && !t.buildingId && !n.buildingId;
  })!;
const check = (defId: string, tile: { x: number; z: number }, extra: object = {}) => ({ defId, tile, rotation: 0 as const, minFreeTiles: 6, ...extra });

describe('footprint and occupancy (Step 3.11)', () => {
  it('covers w×d tiles from the low corner, swapped at 90° and 270°', () => {
    expect(footprintTiles({ x: 1, z: 1 }, { w: 2, d: 1 }, 0)).toEqual([{ x: 1, z: 1 }, { x: 2, z: 1 }]);
    expect(footprintTiles({ x: 1, z: 1 }, { w: 2, d: 1 }, 90)).toEqual([{ x: 1, z: 1 }, { x: 1, z: 2 }]);
    expect(footprintTiles({ x: 0, z: 0 }, { w: 3, d: 3 }, 180)).toHaveLength(9);
  });

  it('marks every footprint tile; a footbridge stays walkable but nobody lives on water', () => {
    const g0 = grid();
    const pair = flatPair(g0);
    const g = grid([{ id: 'b1', defId: 't-long', tile: pair, rotation: 0 }]);
    for (const t of footprintTiles(pair, { w: 2, d: 1 })) expect(g.get(tileKey(t))).toMatchObject({ buildingId: 'b1', walkable: false, buildable: false });
    const water = [...g0.values()].find((t) => t.water)!;
    const bridged = grid([{ id: 'br', defId: 't-bridge', tile: water, rotation: 0 }]).get(tileKey(water))!;
    expect(bridged).toMatchObject({ bridge: true, walkable: true, buildable: false });
    expect(isFreeForAnimal(bridged)).toBe(false);
  });
});

describe('placementProblem (Step 3.11)', () => {
  it('accepts a free flat spot, also over an animal', () => {
    const g = grid();
    expect(placementProblem(g, check('t-post', { x: 2, z: 2 }))).toBeNull();
    expect(placementProblem(g, check('t-long', flatPair(g)))).toBeNull();
  });

  it('rejects off-island, camp, water, other buildings and uneven ground', () => {
    const g = grid();
    expect(placementProblem(g, check('t-post', { x: 99, z: 0 }))).toBe('off_island');
    expect(placementProblem(g, check('t-post', CAMP_RESERVED[0]!))).toBe('camp');
    const water = [...g.values()].find((t) => t.water)!;
    expect(placementProblem(g, check('t-post', water))).toBe('water');
    expect(placementProblem(g, check('t-bridge', water))).toBeNull();
    const pair = flatPair(g);
    const taken = grid([{ id: 'x', defId: 't-post', tile: pair, rotation: 0 }]);
    expect(placementProblem(taken, check('t-long', pair))).toBe('occupied');
    expect(placementProblem(taken, check('t-long', pair, { movingId: 'x' }))).toBeNull();
    const step = [...g.values()].find((t) => {
      const n = g.get(tileKey({ x: t.x + 1, z: t.z }));
      return n && !t.water && !n.water && !t.campReserved && !n.campReserved && n.height !== t.height;
    });
    if (step) expect(placementProblem(g, check('t-long', step))).toBe('uneven');
  });

  it('keeps minFreeTiles for animals', () => {
    const g = grid();
    const land = [...g.values()].filter((t) => !t.water && !t.campReserved).length;
    const pair = flatPair(g);
    expect(placementProblem(g, check('t-long', pair, { minFreeTiles: land - 2 }))).toBeNull();
    expect(placementProblem(g, check('t-long', pair, { minFreeTiles: land - 1 }))).toBe('too_full');
  });

  it('rotation changes which tiles are checked', () => {
    const g = grid();
    const pair = flatPair(g);
    // Rotated 90°, the 2×1 building covers (x, z) and (x, z + 1) instead.
    const below = g.get(tileKey({ x: pair.x, z: pair.z + 1 }));
    const expected = !below ? 'off_island' : below.campReserved ? 'camp' : below.water ? 'water' : below.height !== pair.height ? 'uneven' : null;
    expect(placementProblem(g, check('t-long', pair, { rotation: 90 }))).toBe(expected);
  });
});
