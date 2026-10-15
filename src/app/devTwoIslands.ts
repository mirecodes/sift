import { seededRng } from '../domain/random';
import { pickPlacementTile } from '../domain/island/island';
import { animalTile, getOccupancy, isFreeForAnimal } from '../domain/island/occupancy';
import type { IslandModel } from '../domain/island/model';

/**
 * Development-only view (Step 0.8): `?twoIslands` or `?twoIslands=<seed>` renders a second island
 * next to the user's, to prove the renderer has no hidden global state (needed by F5, F7, F8).
 * `null` in production builds (`import.meta.env.DEV` is false and the branch is removed).
 */
export const DEV_TWO_ISLANDS: number | null = (() => {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get('twoIslands');
  return value === null ? null : Number(value) || 1;
})();

/** The same animals re-placed on an island from another seed. */
export function devSecondIsland(own: IslandModel, seed: number): IslandModel {
  const rng = seededRng(seed);
  const placed: IslandModel['animals'] = [];
  for (const a of own.animals) {
    const grid = getOccupancy({ seed, islandLevel: own.islandLevel, animals: placed, buildings: [] });
    const tile = pickPlacementTile([...grid.values()].filter(isFreeForAnimal), [], rng);
    if (tile) placed.push({ ...a, id: `dev-${a.id}`, tile: animalTile({ tileX: tile.x, tileZ: tile.z }) });
  }
  return { ...own, ownerId: 'dev', seed, animals: placed };
}
