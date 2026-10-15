import { describe, expect, it } from 'vitest';
import { balance } from '../../../shared/balance/balance';
import { getSpecies } from '../animals/catalog';
import { newPlacedAnimal } from '../animals/placed';
import { seededRng } from '../random';
import type { PlacedAnimal } from '../types';
import { islandLevel, pickNewAnimalTile } from './level';
import { getOccupancy, isStandable, repairPlacements, tileKey } from './occupancy';

const SEED = 4;
const chick = getSpecies('chick');
const animal = (i: number, x: number, z: number): PlacedAnimal => newPlacedAnimal(`a${i}`, chick, { x, z }, 0, 's');

/**
 * Animals alone never fill an island (it has about 3 tiles per animal ever earned), so a full island
 * is built with buildings: `open` land tiles stay free of buildings and each holds `perTile` animals;
 * every other land tile, on the island and on the next larger one, is covered by a 1×1 building.
 */
function crowded(open: number, perTile: number) {
  const animals: PlacedAnimal[] = [];
  const level = open * perTile;
  const land = [...getOccupancy({ seed: SEED, islandLevel: level + 1, animals: [], buildings: [] }).values()]
    .filter(isStandable)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const kept = land.slice(0, open);
  kept.forEach((t, i) => {
    for (let k = 0; k < perTile; k++) animals.push(animal(i * perTile + k, t.x, t.z));
  });
  const buildings = land.slice(open).map((t, i) => ({ id: `b${i}`, tile: { x: t.x, z: t.z } }));
  return { animals, buildings, kept };
}

describe('animal placement with buildings (Step 3.13)', () => {
  it('never puts a new animal on a building, camp or water tile', () => {
    const rng = seededRng(1);
    const grid0 = getOccupancy({ seed: SEED, islandLevel: 5, animals: [], buildings: [] });
    const well = [...grid0.values()].find(isStandable)!;
    const buildings = [{ id: 'w', defId: 'well', tile: { x: well.x, z: well.z } }];
    const animals: PlacedAnimal[] = [];
    for (let i = 0; i < 30; i++) {
      const tile = pickNewAnimalTile(SEED, animals, rng, buildings)!;
      const info = getOccupancy({ seed: SEED, islandLevel: islandLevel(animals) + 1, animals: [], buildings }).get(tileKey(tile))!;
      expect(isStandable(info)).toBe(true);
      expect(tileKey(tile)).not.toBe(tileKey(well));
      animals.push(animal(i, tile.x, tile.z));
    }
  });

  it('shares the emptiest tile when none is free, up to the limit per tile', () => {
    const { animals, buildings, kept } = crowded(4, 1);
    const tile = pickNewAnimalTile(SEED, animals, seededRng(2), buildings)!;
    expect(kept.map(tileKey)).toContain(tileKey(tile));
    expect(animals.filter((a) => a.tileX === tile.x && a.tileZ === tile.z)).toHaveLength(1);
  });

  it('gives up only when every tile holds the maximum', () => {
    const { animals, buildings } = crowded(2, balance.placement.maxPerTile);
    expect(pickNewAnimalTile(SEED, animals, seededRng(3), buildings)).toBeUndefined();
    const { animals: almost, buildings: b2 } = crowded(2, balance.placement.maxPerTile - 1);
    expect(pickNewAnimalTile(SEED, almost, seededRng(3), b2)).toBeDefined();
  });

  it('save repair moves an animal off a new building to a shared tile when nothing is free', () => {
    const { animals, buildings, kept } = crowded(3, 1);
    const victim = animals[0]!;
    const moved = repairPlacements(
      { seed: SEED, islandLevel: islandLevel(animals), buildings: [...buildings, { id: 'new', tile: { x: victim.tileX, z: victim.tileZ } }] },
      animals,
    );
    expect(moved.map((a) => a.id)).toEqual([victim.id]);
    expect(kept.slice(1).map(tileKey)).toContain(`${moved[0]!.tileX},${moved[0]!.tileZ}`);
  });
});
