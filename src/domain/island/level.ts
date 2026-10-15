import { isActive } from '../animals/placed';
import { pickPlacementTile } from '../../../shared/rules/placement';
import type { Rng } from '../random';
import type { PlacedAnimal } from '../types';
import type { Tile } from './island';
import { animalTile, getOccupancy, isFreeForAnimal } from './occupancy';

/**
 * The island size input (ADR-032): every animal ever earned on this save, whatever its status.
 * Animals that depart, vanish or are spent never shrink the island, so stored tiles stay valid.
 */
export const islandLevel = (animals: readonly PlacedAnimal[]): number => animals.length;

/**
 * A free tile (occupancy grid) for the next earned animal: on the current island, or on the
 * island one level larger if the current one is full. Only active animals occupy tiles.
 */
export function pickNewAnimalTile(seed: number, animals: readonly PlacedAnimal[], rng: Rng): Tile | undefined {
  const active = animals.filter(isActive).map((a) => ({ id: a.id, tile: animalTile(a) }));
  const level = islandLevel(animals);
  for (const l of [level, level + 1]) {
    const free = [...getOccupancy({ seed, islandLevel: l, animals: active, buildings: [] }).values()].filter(isFreeForAnimal);
    const tile = pickPlacementTile(free, [], rng);
    if (tile) return { x: tile.x, z: tile.z };
  }
  return undefined;
}
