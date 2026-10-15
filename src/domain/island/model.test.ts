import { describe, expect, it } from 'vitest';
import { getSpecies } from '../animals/catalog';
import { newPlacedAnimal } from '../animals/placed';
import { buildIslandModel } from './model';

const fox = newPlacedAnimal('a1', getSpecies('fox'), { x: 1, z: 2 }, 0, 's1');
const cat = newPlacedAnimal('a2', getSpecies('cat'), { x: -1, z: 0 }, 0, 's2');
const gone = { ...newPlacedAnimal('a3', getSpecies('chick'), { x: 0, z: 1 }, 0, 's3'), status: 'departed' as const };
const world = { seed: 7, blockThemeId: 'default' };

describe('buildIslandModel', () => {
  it('maps the local save to plain island data with defaults', () => {
    expect(buildIslandModel({ world, islandLevel: 3, animals: [fox, cat, gone] })).toEqual({
      ownerId: 'local',
      seed: 7,
      islandLevel: 3,
      blockThemeId: 'default',
      animals: [
        { id: 'a1', speciesId: 'fox', tierRank: 2, tile: { x: 1, z: 2 }, skinId: 'default' },
        { id: 'a2', speciesId: 'cat', tierRank: 1, tile: { x: -1, z: 0 }, skinId: 'default' },
      ],
      buildings: [],
      goldPileLevel: 0,
    });
  });

  it('applies equipped skins per species, theme, buildings, pile and champion flag', () => {
    const m = buildIslandModel({
      ownerId: 'u1',
      world,
      islandLevel: 3,
      animals: [fox],
      equipped: { skinBySpecies: { fox: 'golden:fox' }, blockThemeId: 'autumn' },
      buildings: [{ id: 'b1', defId: 'well', tileX: 2, tileZ: -2, rotation: 90, placedAt: 0 }],
      goldPileLevel: 3,
      championWeek: '2026-W41',
    });
    expect(m).toMatchObject({ ownerId: 'u1', blockThemeId: 'autumn', goldPileLevel: 3, championWeek: '2026-W41' });
    expect(m.animals[0]?.skinId).toBe('golden:fox');
    expect(m.buildings).toEqual([{ id: 'b1', defId: 'well', tile: { x: 2, z: -2 }, rotation: 90 }]);
  });

  it('is pure: the same input gives an equal model and inputs are not mutated', () => {
    const input = { world, islandLevel: 3, animals: [fox, cat] };
    const copy = structuredClone(input);
    expect(buildIslandModel(input)).toEqual(buildIslandModel(input));
    expect(input).toEqual(copy);
  });
});
