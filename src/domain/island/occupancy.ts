import { content } from '../content';
import type { PlacedAnimal } from '../types';
import { CAMP_RESERVED, islandSide, islandTiles, type Tile } from './island';

export type Rotation = 0 | 90 | 180 | 270;
export interface Footprint {
  w: number;
  d: number;
}

/** Tiles under a building: `tile` is the corner with the lowest x and z; 90° and 270° swap width and depth. */
export function footprintTiles(tile: Tile, footprint: Footprint, rotation: Rotation = 0): Tile[] {
  const [w, d] = rotation === 90 || rotation === 270 ? [footprint.d, footprint.w] : [footprint.w, footprint.d];
  const out: Tile[] = [];
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) out.push({ x: tile.x + dx, z: tile.z + dz });
  return out;
}

/** Footprint and water rule of a building definition (1×1 for unknown ids). */
export function buildingShape(defId: string | undefined): { footprint: Footprint; allowOnWater: boolean } {
  const def = defId ? content.get(defId) : undefined;
  return def?.kind === 'building' ? { footprint: def.footprint, allowOnWater: def.allowOnWater === true } : { footprint: { w: 1, d: 1 }, allowOnWater: false };
}

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
  /** Covered by a building animals walk over (footbridge): walkable, even on water. */
  bridge?: boolean;
}

/** The parts of an `IslandModel` that decide what is on a tile. */
export interface OccupancyInput {
  seed: number;
  islandLevel: number;
  animals: readonly { id: string; tile: Tile }[];
  /** `defId` gives the footprint (from content); without it a building covers its tile only. */
  buildings: readonly { id: string; tile: Tile; defId?: string; rotation?: Rotation }[];
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
  for (const b of model.buildings) {
    const { footprint, allowOnWater } = buildingShape(b.defId);
    for (const t of footprintTiles(b.tile, footprint, b.rotation)) {
      const info = grid.get(tileKey(t));
      if (!info) continue;
      info.buildingId = b.id;
      info.buildable = false;
      // A footbridge is walked over; any other building blocks the tile.
      info.bridge = allowOnWater;
      info.walkable = allowOnWater && !info.campReserved;
    }
  }
  for (const a of model.animals) grid.get(tileKey(a.tile))?.animalIds.push(a.id);
  return grid;
}

/** An animal may live here: walkable and on land (a footbridge over water is walked over, not lived on). */
export const isStandable = (info: TileInfo): boolean => info.walkable && !info.water;

/** Free for a new or moved animal: standable and nobody on it. */
export const isFreeForAnimal = (info: TileInfo): boolean => isStandable(info) && info.animalIds.length === 0;

export const animalTile = (a: Pick<PlacedAnimal, 'tileX' | 'tileZ'>): Tile => ({ x: a.tileX, z: a.tileZ });

/**
 * Save repair (Step 0.7): every active animal standing where animals may not (water, camp,
 * reserved, a building, off the island) moves to the nearest free tile. Returns only the moved
 * animals, with their new tiles. Idempotent: a repaired save returns `[]`.
 */
export function repairPlacements(input: Omit<OccupancyInput, 'animals'>, active: readonly PlacedAnimal[]): PlacedAnimal[] {
  const grid = getOccupancy({ ...input, animals: active.map((a) => ({ id: a.id, tile: animalTile(a) })) });
  const misplaced = active.filter((a) => {
    const info = grid.get(tileKey(animalTile(a)));
    return !info || !isStandable(info);
  });
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
