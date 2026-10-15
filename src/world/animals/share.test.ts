import { describe, expect, it } from 'vitest';
import type { IslandAnimal } from '../../domain/island/model';
import { spreadShared } from './Animals';

const a = (id: string, x: number, z: number): IslandAnimal => ({ id, speciesId: 'chick', tierRank: 0, tile: { x, z }, skinId: 'default' });

describe('animals sharing a tile (Step 3.13)', () => {
  it('keeps a lone animal at the tile center and gives sharers distinct corners', () => {
    const out = spreadShared([a('1', 0, 0), a('2', 1, 1), a('3', 1, 1), a('4', 1, 1), a('5', 1, 1)]);
    expect(out[0]!.tile).toEqual({ x: 0, z: 0 });
    const spots = out.slice(1).map((x) => `${x.tile.x},${x.tile.z}`);
    expect(new Set(spots).size).toBe(4);
    for (const x of out.slice(1)) {
      expect(Math.round(x.tile.x)).toBe(1);
      expect(Math.round(x.tile.z)).toBe(1);
    }
  });
});
