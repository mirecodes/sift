import type { PlacedAnimal } from '../types';
import { CAMP_RESERVED, islandSide, islandTiles, type Tile } from './island';

/** `"x,z"` */
export type TileKey = string;
export const tileKey = (t: Tile): TileKey => `${t.x},${t.z}`;

export interface TileInfo extends Tile {
  /** `Cell.top`: the walkable surface is at `height + 0.5`. */
  height: number;
  water: boolean;
  /** Campfire, cabin, and the coin pile tile next to the cabin. */
  campReserved: boolean;
  buildingId?: string;
  animalIds: string[];
  /** Animals may stand and walk here. */
  walkable: boolean;
  /** A building may be placed here (animals on it hop away). */
  buildable: boolean;
}

/** The parts of an `IslandModel` that decide what is on a tile. */
export interface OccupancyInput {
  seed: number;
  islandLevel: number;
  animals: readonly { id: string; tile: Tile }[];
  buildings: readonly { id: string; tile: Tile }[];
}

const CAMP = new Set(CAMP_RESERVED.map(tileKey));

/**
 * The one occupancy grid (ADR-033): terrain height, water, camp reserve, buildings and animals per
 * tile. Animal placement, save repair and (later) building placement, routines, war formation and
 * island moves all read it.
 */
export function getOccupancy(model: OccupancyInput): Map<TileKey, TileInfo> {
  const grid = new Map<TileKey, TileInfo>();
  for (const cell of islandTiles(model.seed, islandSide(model.islandLevel))) {
    const water = cell.water === true;
    const campReserved = CAMP.has(tileKey(cell));
    grid.set(tileKey(cell), { x: cell.x, z: cell.z, height: cell.top, water, campReserved, animalIds: [], walkable: !water && !campReserved, buildable: !water && !campReserved });
  }
  // ponytail: buildings occupy their anchor tile only; footprints arrive with BuildingDef (Step 3.1).
  for (const b of model.buildings) {
    const info = grid.get(tileKey(b.tile));
    if (!info) continue;
    info.buildingId = b.id;
    info.walkable = false;
    info.buildable = false;
  }
  for (const a of model.animals) grid.get(tileKey(a.tile))?.animalIds.push(a.id);
  return grid;
}

/** Free for a new or moved animal: walkable and nobody on it. */
export const isFreeForAnimal = (info: TileInfo): boolean => info.walkable && info.animalIds.length === 0;

export const animalTile = (a: Pick<PlacedAnimal, 'tileX' | 'tileZ'>): Tile => ({ x: a.tileX, z: a.tileZ });

/**
 * Save repair (Step 0.7): every active animal standing where animals may not (water, camp,
 * reserved, a building, off the island) moves to the nearest free tile. Returns only the moved
 * animals, with their new tiles. Idempotent: a repaired save returns `[]`.
 */
export function repairPlacements(input: Omit<OccupancyInput, 'animals'>, active: readonly PlacedAnimal[]): PlacedAnimal[] {
  const grid = getOccupancy({ ...input, animals: active.map((a) => ({ id: a.id, tile: animalTile(a) })) });
  const misplaced = active.filter((a) => !grid.get(tileKey(animalTile(a)))?.walkable);
  const moved: PlacedAnimal[] = [];
  for (const a of misplaced) {
    const dist = (t: Tile) => Math.hypot(t.x - a.tileX, t.z - a.tileZ);
    const target = [...grid.values()].filter(isFreeForAnimal).sort((p, q) => dist(p) - dist(q) || p.x - q.x || p.z - q.z)[0];
    if (!target) continue; // ponytail: a completely full island keeps the overlap; tile sharing arrives in Step 3.13
    target.animalIds.push(a.id);
    moved.push({ ...a, tileX: target.x, tileZ: target.z });
  }
  return moved;
}
