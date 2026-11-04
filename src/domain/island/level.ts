import { isActive } from '../animals/placed';
import { pickPlacementTile } from '../../../shared/rules/placement';
import type { Rng } from '../random';
import type { PlacedAnimal } from '../types';
import type { Tile } from './island';
import { balance } from '../../../shared/balance/balance';
import { animalTile, getOccupancy, isFreeForAnimal, isStandable, type OccupancyInput, type TileInfo } from './occupancy';

/**
 * The island size input (ADR-032): every animal ever earned on this save, whatever its status.
 * Animals that depart, vanish or are spent never shrink the island, so stored tiles stay valid.
 */
export const islandLevel = (animals: readonly PlacedAnimal[]): number => animals.length;

/**
 * A free tile (occupancy grid, buildings included) for the next earned animal: on the current
 * island, or on the island one level larger if the current one is full. Only active animals occupy
 * tiles. With no free tile left (Step 3.13) the animal shares the least crowded tile animals may live
 * on, up to `balance.placement.maxPerTile`; undefined only when every such tile is full.
 */
export function pickNewAnimalTile(seed: number, animals: readonly PlacedAnimal[], rng: Rng, buildings: OccupancyInput['buildings'] = []): Tile | undefined {
  const active = animals.filter(isActive).map((a) => ({ id: a.id, tile: animalTile(a) }));
  const level = islandLevel(animals);
  for (const l of [level, level + 1]) {
    const free = [...getOccupancy({ seed, islandLevel: l, animals: active, buildings }).values()].filter(isFreeForAnimal);
    const tile = pickPlacementTile(free, [], rng);
    if (tile) return { x: tile.x, z: tile.z };
  }
  const shared = leastCrowded(getOccupancy({ seed, islandLevel: level + 1, animals: active, buildings }));
  const tile = pickPlacementTile(shared, [], rng);
  return tile ? { x: tile.x, z: tile.z } : undefined;
}

/**
 * Places animals one after another on an island (island move, Step 4.1): each takes a free tile
 * (center-weighted, `pickPlacementTile`) or, once none is free, shares the emptiest tile. Animals left
 * without room keep no entry. The level is fixed: a move never grows or shrinks the island.
 */
export function placeAnimals(seed: number, level: number, ids: readonly string[], rng: Rng, buildings: OccupancyInput['buildings'] = []): Map<string, Tile> {
  const placed: { id: string; tile: Tile }[] = [];
  const out = new Map<string, Tile>();
  for (const id of ids) {
    const grid = getOccupancy({ seed, islandLevel: level, animals: placed, buildings });
    const free = [...grid.values()].filter(isFreeForAnimal);
    const tile = pickPlacementTile(free, [], rng) ?? pickPlacementTile(leastCrowded(grid), [], rng);
    if (!tile) continue;
    placed.push({ id, tile: { x: tile.x, z: tile.z } });
    out.set(id, { x: tile.x, z: tile.z });
  }
  return out;
}

/** Tiles animals may live on that have room, the emptiest ones only. */
export function leastCrowded(grid: ReadonlyMap<string, TileInfo>): TileInfo[] {
  const open = [...grid.values()].filter((t) => isStandable(t) && t.animalIds.length < balance.placement.maxPerTile);
  const fewest = Math.min(...open.map((t) => t.animalIds.length));
  return open.filter((t) => t.animalIds.length === fewest);
}
