import { describe, expect, it } from 'vitest';
import { getSpecies } from '../animals/catalog';
import { newPlacedAnimal } from '../animals/placed';
import { seededRng } from '../random';
import { IDLE, startBreak, startFocus } from '../timer/phase';
import type { PlacedAnimal, PlacedBuilding } from '../types';
import { islandLevel } from './level';
import { moveIsland, type MoveInput } from './move';
import { getOccupancy, isStandable, tileKey } from './occupancy';

const animal = (id: string, species: string, acquiredAt: number, extra: Partial<PlacedAnimal> = {}): PlacedAnimal => ({
  ...newPlacedAnimal(id, getSpecies(species), { x: 1, z: 1 }, acquiredAt, 's'),
  ...extra,
});
const building: PlacedBuilding = { id: 'b1', defId: 'fence', tileX: 2, tileZ: 2, rotation: 0, placedAt: 5 };

const input = (over: Partial<MoveInput> = {}): MoveInput => ({
  phase: IDLE,
  world: { seed: 11, blockThemeId: 'autumn' },
  animals: [
    animal('u-new', 'unicorn', 300),
    animal('u-old', 'unicorn', 100),
    animal('fox', 'fox', 200, { pinned: true }),
    animal('gone', 'chick', 50, { status: 'departed', endedAt: 60, endReason: 'expired' }),
    ...Array.from({ length: 12 }, (_, i) => animal(`c${i}`, 'chick', 400 + i)),
  ],
  buildings: [building],
  history: [],
  newSeed: 77,
  now: 1000,
  rng: seededRng(3),
  historyId: 'h1',
  ...over,
});

describe('moveIsland (Step 4.1)', () => {
  it('spends the oldest active Unicorn and keeps the level', () => {
    const out = moveIsland(input());
    if (typeof out === 'string') throw new Error(out);
    expect(out.spent).toMatchObject({ id: 'u-old', status: 'spent', endReason: 'island_move', endedAt: 1000 });
    expect(out.world).toEqual({ seed: 77, blockThemeId: 'autumn' });
    // The level counts every animal ever earned, so it is the same before and after.
    const after = input().animals.map((a) => out.animals.find((b) => b.id === a.id) ?? a);
    expect(islandLevel(after)).toBe(islandLevel(input().animals));
  });

  it('re-places every other active animal on the new terrain, clears pins, keeps expiry clocks', () => {
    const out = moveIsland(input());
    if (typeof out === 'string') throw new Error(out);
    const moved = out.animals.filter((a) => a.id !== 'u-old');
    expect(moved.map((a) => a.id).sort()).toEqual(['fox', 'u-new', ...Array.from({ length: 12 }, (_, i) => `c${i}`)].sort());
    const grid = getOccupancy({ seed: 77, islandLevel: islandLevel(input().animals), animals: [], buildings: [] });
    const tiles = new Set<string>();
    for (const a of moved) {
      expect(isStandable(grid.get(tileKey({ x: a.tileX, z: a.tileZ }))!), a.id).toBe(true);
      expect(a.pinned).toBe(false);
      expect(a.acquiredAt).toBe(input().animals.find((b) => b.id === a.id)!.acquiredAt);
      tiles.add(`${a.tileX},${a.tileZ}`);
    }
    expect(tiles.size).toBe(moved.length); // one animal per tile while there is room
    expect(out.animals.some((a) => a.id === 'gone')).toBe(false);
  });

  it('returns every building and records the old island', () => {
    const out = moveIsland(input({ history: [{ id: 'h0', seed: 5, from: 0, to: 40 }] }));
    if (typeof out === 'string') throw new Error(out);
    expect(out.buildingsRemoved).toEqual(['b1']);
    expect(out.history).toEqual({ id: 'h1', seed: 11, from: 50, to: 1000 });
    const first = moveIsland(input());
    if (typeof first === 'string') throw new Error(first);
    expect(first.history.from).toBe(50); // earliest animal when there is no history
  });

  it('is deterministic for a seed and rng', () => {
    expect(moveIsland(input())).toEqual(moveIsland(input()));
  });

  it('needs Home and a Unicorn', () => {
    expect(moveIsland(input({ phase: startFocus(0, 1, 's') }))).toBe('not_idle');
    expect(moveIsland(input({ phase: startBreak(0, 1) }))).toBe('not_idle');
    const noUnicorn = input().animals.filter((a) => a.speciesId !== 'unicorn');
    expect(moveIsland(input({ animals: noUnicorn }))).toBe('no_unicorn');
    const spentOnly = input().animals.map((a) => (a.speciesId === 'unicorn' ? { ...a, status: 'spent' as const } : a));
    expect(moveIsland(input({ animals: spentOnly }))).toBe('no_unicorn');
  });
});
