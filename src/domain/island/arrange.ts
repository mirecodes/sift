import { balance } from '../../../shared/balance/balance';
import type { PlacedAnimal, PlacedBuilding } from '../types';
import type { Tile } from './island';
import { isActive } from '../animals/placed';
import { animalTile, getOccupancy, isStandable, tileKey } from './occupancy';

/**
 * Arranging animals by hand (guidance_v2 Step 10.1, owner decision rev 3): an animal may go to any tile
 * an animal can stand on (land, not the camp, not under a building; footbridges are fine), shared up to
 * `balance.placement.maxPerTile`. A placed animal is pinned: automatic placement never moves it, except
 * when a building is put on it (it is unpinned and walks away) or the island moves (pins cleared).
 */
export type ArrangeProblem = 'not_standable' | 'crowded';

export interface ArrangeInput {
  seed: number;
  islandLevel: number;
  animals: readonly PlacedAnimal[];
  buildings: readonly PlacedBuilding[];
}

export function arrangeProblem(input: ArrangeInput, animalId: string, tile: Tile): ArrangeProblem | null {
  const others = input.animals.filter((a) => isActive(a) && a.id !== animalId);
  const grid = getOccupancy({
    seed: input.seed,
    islandLevel: input.islandLevel,
    animals: others.map((a) => ({ id: a.id, tile: animalTile(a) })),
    buildings: input.buildings.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })),
  });
  const info = grid.get(tileKey(tile));
  if (!info || !isStandable(info)) return 'not_standable';
  if (info.animalIds.length >= balance.placement.maxPerTile) return 'crowded';
  return null;
}

/** The animal on `tile`, pinned there. */
export function arrangeAnimal(animals: readonly PlacedAnimal[], animalId: string, tile: Tile): PlacedAnimal | null {
  const a = animals.find((x) => x.id === animalId);
  return a && isActive(a) ? { ...a, tileX: tile.x, tileZ: tile.z, pinned: true } : null;
}
