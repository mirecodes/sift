import type { Tile } from '../island/island';
import { buildingShape, footprintTiles, tileKey, type Rotation, type TileInfo, type TileKey } from '../island/occupancy';

/** Why a building cannot go here (Step 3.11). */
export type PlaceProblem = 'off_island' | 'uneven' | 'water' | 'camp' | 'occupied' | 'too_full';

export interface PlaceCheck {
  defId: string;
  tile: Tile;
  rotation: Rotation;
  /** The building being moved: its own tiles count as free. */
  movingId?: string;
  /** `balance.build.minFreeTiles`: tiles that must stay free for animals. */
  minFreeTiles: number;
}

/** The tile nearest the island center where the building fits (where a new ghost starts), or null. */
export function suggestTile(grid: ReadonlyMap<TileKey, TileInfo>, check: Omit<PlaceCheck, 'tile'>): Tile | null {
  const tiles = [...grid.values()].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || a.x - b.x || a.z - b.z);
  // Prefer tiles without animals, so nobody has to move.
  const fits = (t: Tile) => placementProblem(grid, { ...check, tile: t }) === null;
  const best = tiles.find((t) => !t.animalIds.length && fits(t)) ?? tiles.find(fits);
  return best ? { x: best.x, z: best.z } : null;
}

/**
 * Placement validity via the occupancy grid: every footprint tile on the island, all at one height,
 * no water unless `allowOnWater`, no camp tile, no other building, and the island keeps at least
 * `minFreeTiles` tiles animals can live on. Tiles with animals are fine: they hop away on confirm.
 */
export function placementProblem(grid: ReadonlyMap<TileKey, TileInfo>, check: PlaceCheck): PlaceProblem | null {
  const { footprint, allowOnWater } = buildingShape(check.defId);
  const tiles = footprintTiles(check.tile, footprint, check.rotation);
  const infos = tiles.map((t) => grid.get(tileKey(t)));
  if (infos.some((i) => !i)) return 'off_island';
  const cells = infos as TileInfo[];
  if (cells.some((i) => i.campReserved)) return 'camp';
  if (cells.some((i) => i.buildingId !== undefined && i.buildingId !== check.movingId)) return 'occupied';
  if (!allowOnWater && cells.some((i) => i.water)) return 'water';
  if (new Set(cells.map((i) => i.height)).size > 1) return 'uneven';
  const covered = new Set(tiles.map(tileKey));
  let free = 0;
  for (const [key, info] of grid) {
    if (covered.has(key) || info.water || info.campReserved) continue;
    if (info.buildingId === undefined || info.buildingId === check.movingId || info.bridge) free++;
  }
  if (free < check.minFreeTiles) return 'too_full';
  return null;
}
