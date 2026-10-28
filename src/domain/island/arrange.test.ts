import { describe, expect, it } from 'vitest';
import { balance } from '../../../shared/balance/balance';
import { getSpecies } from '../animals/catalog';
import { newPlacedAnimal } from '../animals/placed';
import type { PlacedAnimal } from '../types';
import { arrangeAnimal, arrangeProblem } from './arrange';
import { FIRE_TILE, generateIsland } from './island';
import { pickNewAnimalTile } from './level';
import { seededRng } from '../random';

const SEED = 4242;
const LEVEL = 6;

function island() {
  const rng = seededRng(1);
  const animals: PlacedAnimal[] = [];
  for (let i = 0; i < LEVEL; i++) {
    const tile = pickNewAnimalTile(SEED, animals, rng)!;
    animals.push(newPlacedAnimal(`a${i}`, getSpecies('fox'), tile, i, `s${i}`));
  }
  const tiles = generateIsland(SEED, LEVEL).tiles;
  const land = tiles.filter((t) => !t.water && Math.hypot(t.x, t.z) > 2.5);
  return { animals, tiles, land };
}

describe('arranging animals (Step 10.1)', () => {
  it('accepts free land and pins the animal there', () => {
    const { animals, land } = island();
    const target = land.find((t) => !animals.some((a) => a.tileX === t.x && a.tileZ === t.z))!;
    const input = { seed: SEED, islandLevel: LEVEL, animals, buildings: [] };
    expect(arrangeProblem(input, 'a0', target)).toBeNull();
    expect(arrangeAnimal(animals, 'a0', target)).toMatchObject({ id: 'a0', tileX: target.x, tileZ: target.z, pinned: true });
  });

  it('rejects water, the camp, buildings and tiles outside the island', () => {
    const { animals, tiles, land } = island();
    const input = { seed: SEED, islandLevel: LEVEL, animals, buildings: [] };
    const water = tiles.find((t) => t.water);
    if (water) expect(arrangeProblem(input, 'a0', water)).toBe('not_standable');
    expect(arrangeProblem(input, 'a0', FIRE_TILE)).toBe('not_standable');
    expect(arrangeProblem(input, 'a0', { x: 99, z: 99 })).toBe('not_standable');
    const spot = land[0]!;
    const withWell = { ...input, buildings: [{ id: 'b', defId: 'well', tileX: spot.x, tileZ: spot.z, rotation: 0 as const, placedAt: 0 }] };
    expect(arrangeProblem(withWell, 'a0', spot)).toBe('not_standable');
  });

  it('allows sharing a tile up to the limit', () => {
    const { animals, land } = island();
    const spot = land[0]!;
    const crowd = animals.map((a, i) => (i < balance.placement.maxPerTile ? { ...a, tileX: spot.x, tileZ: spot.z } : a));
    const input = { seed: SEED, islandLevel: LEVEL, animals: crowd, buildings: [] };
    expect(arrangeProblem(input, `a${balance.placement.maxPerTile}`, spot)).toBe('crowded');
    // An animal already there may stay (it does not count against itself).
    expect(arrangeProblem(input, 'a0', spot)).toBeNull();
  });

  it('never arranges departed animals', () => {
    const { animals } = island();
    const gone = animals.map((a) => (a.id === 'a1' ? { ...a, status: 'departed' as const } : a));
    expect(arrangeAnimal(gone, 'a1', { x: 0, z: 1 })).toBeNull();
  });
});
