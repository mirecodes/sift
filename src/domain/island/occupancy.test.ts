import { describe, expect, it } from 'vitest';
import { getSpecies } from '../animals/catalog';
import { newPlacedAnimal } from '../animals/placed';
import type { PlacedAnimal } from '../types';
import { CAMP_LEVEL, CAMP_RESERVED, COIN_PILE_TILE, FIRE_TILE, HUT_TILE, islandSide, islandTiles, levelTop } from './island';
import { animalTile, getOccupancy, isFreeForAnimal, repairPlacements, tileKey } from './occupancy';

const at = (id: string, x: number, z: number): PlacedAnimal => newPlacedAnimal(id, getSpecies('chick'), { x, z }, 0, 's');
/** A seed whose 7×7 island has a stream (water tiles to misplace an animal on). */
const SEED = Array.from({ length: 50 }, (_, i) => i + 1).find((s) => islandTiles(s, 7).some((t) => t.water))!;
const LEVEL = 10;

describe('occupancy grid', () => {
  it('marks camp, water, buildings and animals', () => {
    const water = islandTiles(SEED, islandSide(LEVEL)).find((t) => t.water)!;
    const grid = getOccupancy({ seed: SEED, islandLevel: LEVEL, animals: [{ id: 'a', tile: { x: 1, z: 1 } }, { id: 'b', tile: { x: 1, z: 1 } }], buildings: [{ id: 'well', tile: { x: 2, z: -2 } }] });
    for (const c of CAMP_RESERVED) expect(grid.get(tileKey(c))).toMatchObject({ campReserved: true, walkable: false, buildable: false });
    expect(grid.get(tileKey(water))).toMatchObject({ water: true, walkable: false, buildable: false });
    expect(grid.get('2,-2')).toMatchObject({ buildingId: 'well', walkable: false, buildable: false });
    expect(grid.get('1,1')).toMatchObject({ animalIds: ['a', 'b'], walkable: true, buildable: true });
    expect(isFreeForAnimal(grid.get('1,1')!)).toBe(false);
    expect(grid.size).toBe(islandTiles(SEED, islandSide(LEVEL)).length);
  });

  it('keeps the coin pile tile on the island, flat at camp height and dry for every seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const info = getOccupancy({ seed, islandLevel: 0, animals: [], buildings: [] }).get(tileKey(COIN_PILE_TILE));
      expect(info, `seed ${seed}`).toMatchObject({ water: false, height: levelTop(CAMP_LEVEL), campReserved: true });
    }
  });
});

describe('save repair', () => {
  const water = islandTiles(SEED, islandSide(LEVEL)).find((t) => t.water)!;
  const fixture = [
    at('ok1', 1, 1),
    at('fire', FIRE_TILE.x, FIRE_TILE.z),
    at('hut', HUT_TILE.x, HUT_TILE.z),
    at('pile', COIN_PILE_TILE.x, COIN_PILE_TILE.z),
    at('wet', water.x, water.z),
    at('outside', 40, 40),
    at('ok2', 1, -1),
  ];

  it('moves every misplaced active animal to the nearest free tile and keeps the rest', () => {
    const moved = repairPlacements({ seed: SEED, islandLevel: LEVEL, buildings: [] }, fixture);
    expect(moved.map((a) => a.id).sort()).toEqual(['fire', 'hut', 'outside', 'pile', 'wet']);

    const after = fixture.map((a) => moved.find((m) => m.id === a.id) ?? a);
    const grid = getOccupancy({ seed: SEED, islandLevel: LEVEL, animals: [], buildings: [] });
    for (const a of after) expect(grid.get(tileKey(animalTile(a)))?.walkable, a.id).toBe(true);
    expect(new Set(after.map((a) => tileKey(animalTile(a)))).size).toBe(after.length);

    // Nearest: no free tile was closer to the original spot than the chosen one (at the moment it was chosen).
    const fire = moved.find((a) => a.id === 'fire')!;
    expect(Math.hypot(fire.tileX - FIRE_TILE.x, fire.tileZ - FIRE_TILE.z)).toBe(1);
    // Only tiles change.
    for (const m of moved) expect({ ...m, tileX: 0, tileZ: 0 }).toEqual({ ...fixture.find((a) => a.id === m.id)!, tileX: 0, tileZ: 0 });
  });

  it('is idempotent', () => {
    const moved = repairPlacements({ seed: SEED, islandLevel: LEVEL, buildings: [] }, fixture);
    const after = fixture.map((a) => moved.find((m) => m.id === a.id) ?? a);
    expect(repairPlacements({ seed: SEED, islandLevel: LEVEL, buildings: [] }, after)).toEqual([]);
  });

  it('moves animals off buildings too', () => {
    const moved = repairPlacements({ seed: SEED, islandLevel: LEVEL, buildings: [{ id: 'b', tile: { x: 1, z: 1 } }] }, [at('ok1', 1, 1)]);
    expect(moved).toHaveLength(1);
    expect(tileKey(animalTile(moved[0]!))).not.toBe('1,1');
  });
});
