import { isActive } from '../animals/placed';
import type { Rng } from '../random';
import type { PlacedAnimal } from '../types';
import { islandTiles, islandSide, pickPlacementTile, type Tile } from './island';

/**
 * The island size input (ADR-032): every animal ever earned on this save, whatever its status.
 * Animals that depart, vanish or are spent never shrink the island, so stored tiles stay valid.
 */
export const islandLevel = (animals: readonly PlacedAnimal[]): number => animals.length;

/**
 * A free tile for the next earned animal: on the current island, or on the island one level
 * larger if the current one is full. Only active animals occupy tiles.
 */
export function pickNewAnimalTile(seed: number, animals: readonly PlacedAnimal[], rng: Rng): Tile | undefined {
  const occupied = animals.filter(isActive).map((a) => ({ x: a.tileX, z: a.tileZ }));
  const level = islandLevel(animals);
  return (
    pickPlacementTile(islandTiles(seed, islandSide(level)), occupied, rng) ??
    pickPlacementTile(islandTiles(seed, islandSide(level + 1)), occupied, rng)
  );
}
