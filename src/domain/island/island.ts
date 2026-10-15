import { config } from '../config';
import { clamp, hash01, type Rng } from '../random';
import { streamRuns, type StreamContext, type StreamTile } from './stream';
import { pickPlacementTile as placeOnTiles, type Tile } from '../../../shared/rules/placement';

export type { StreamTile, Tile };

export type BlockKind = 'grass' | 'dirt' | 'stone';

export interface Block extends Tile {
  /** Center of the block. Full blocks sit at integer y (0 down to `-depth`), slabs above y = 0. */
  y: number;
  kind: BlockKind;
  /** Block height: 1 for a full block, `levelHeight` for a terrain slab. */
  h: number;
}

/** A surface tile with its height. The walkable surface is at `top + 0.5`. */
export interface Cell extends Tile {
  top: number;
  /** Stream bed: the water surface is at `top + 0.5 - bedDepth + waterDepth`. Animals never stand here. */
  water?: true;
}

export interface IslandLayout {
  side: number;
  /** Surface tiles, relative to the island center. */
  tiles: Cell[];
  blocks: Block[];
  /** Runs of stream tiles on this island; the last tile of each run falls over the rim. */
  streams: StreamTile[][];
  /** Number of layers below y = 0. */
  depth: number;
  /** Highest `top` on the island (extra headroom above y = 0). */
  rise: number;
}

/** Top side length for an island level (lifetime earned animals): max(7, ceil(sqrt(level × 3))), rounded up to odd. */
export function islandSide(level: number): number {
  const required = Math.max(0, level) * config.island.tilesPerAnimal;
  const side = Math.max(config.island.minSide, Math.ceil(Math.sqrt(required)));
  return side % 2 === 0 ? side + 1 : side;
}

/**
 * Euclidean distance of a tile from the center plus a seeded jitter (near-circular
 * outline). Independent of the island size, which makes shapes monotone: a tile
 * present at one side length is present at every larger one.
 */
const roundedRadius = (x: number, z: number): number => Math.hypot(x, z);

function outlineScore(seed: number, x: number, z: number): number {
  return roundedRadius(x, z) + hash01(seed, x, z, 1) * config.island.outlineJitter;
}

const key = (t: Tile): string => `${t.x},${t.z}`;

export function isTile(seed: number, side: number, x: number, z: number): boolean {
  const h = (side - 1) / 2;
  if (Math.abs(x) > h || Math.abs(z) > h) return false;
  return outlineScore(seed, x, z) <= h + 0.5;
}

function outlineTiles(seed: number, side: number): Tile[] {
  const h = (side - 1) / 2;
  const tiles: Tile[] = [];
  for (let z = -h; z <= h; z++) {
    for (let x = -h; x <= h; x++) {
      if (isTile(seed, side, x, z)) tiles.push({ x, z });
    }
  }
  return tiles;
}


/** Surface tiles with heights. */
export function islandTiles(seed: number, side: number): Cell[] {
  return buildTerrain(seed, side);
}

/** Camp tiles are always this many blocks high (top y = CAMP_LEVEL - 1). */
export const CAMP_LEVEL = 2;

/** 2D gradient noise in [-1, 1] (Perlin-style, seeded by hashed gradient angles). */
function gradientNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const corner = (ix: number, iz: number, dx: number, dz: number) => {
    const a = hash01(seed, ix, iz, 501) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dz;
  };
  const u = fade(fx);
  const v = fade(fz);
  const top = corner(x0, z0, fx, fz) * (1 - u) + corner(x0 + 1, z0, fx - 1, fz) * u;
  const bottom = corner(x0, z0 + 1, fx, fz - 1) * (1 - u) + corner(x0 + 1, z0 + 1, fx - 1, fz - 1) * u;
  return (top * (1 - v) + bottom * v) * 1.41;
}

/** Fractal noise (3 octaves) with domain warping, so ridges bend instead of following the grid. */
function fbm(seed: number, x: number, z: number): number {
  const wx = x + gradientNoise(seed + 1, x * 0.2, z * 0.2) * 2;
  const wz = z + gradientNoise(seed + 2, x * 0.2, z * 0.2) * 2;
  let sum = 0;
  let amp = 1;
  let freq = 0.22;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += gradientNoise(seed + 10 + o, wx * freq, wz * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Terrain level 1..3 at any coordinate. Warped noise plus a weak tilt toward the back (-x, -z),
 * flattened around the camp, then terraced: mostly plains (2) with hills (3) and lowlands (1).
 */
export function terrainLevel(seed: number, x: number, z: number): number {
  const t = config.island.terrain;
  const campDistance = Math.hypot(x - (FIRE_TILE.x + HUT_TILE.x) / 2, z - (FIRE_TILE.z + HUT_TILE.z) / 2);
  const natural = t.noise * fbm(seed, x, z) - t.tilt * (x + z);
  const height = natural * smoothstep(t.flatRadius, t.blendRadius, campDistance);
  return height > t.hill ? 3 : height < t.lowland ? 1 : CAMP_LEVEL;
}

/** `Cell.top` for a terrain level: level 1 is the base block (top 0), each further level adds `levelHeight`. */
export const levelTop = (level: number): number => (level - 1) * config.island.levelHeight;

const streamContext = (seed: number): StreamContext => ({
  natural: (x, z) => terrainLevel(seed, x, z),
  avoid: [FIRE_TILE, HUT_TILE],
});

const runsOf = (seed: number, side: number): StreamTile[][] => streamRuns(seed, streamContext(seed), (x, z) => isTile(seed, side, x, z));

/** The stream replaces the natural terrain on its tiles: same level, cut down later by the bed. Everything else is natural. */
function buildTerrain(seed: number, side: number): Cell[] {
  const bed = new Map(runsOf(seed, side).flat().map((t) => [key(t), t.level]));
  return outlineTiles(seed, side).map((t) => {
    const level = bed.get(key(t));
    return level === undefined ? { ...t, top: levelTop(terrainLevel(seed, t.x, t.z)) } : { ...t, top: levelTop(level), water: true };
  });
}

/** Deterministic: same seed and island level always give the same island. */
export function generateIsland(seed: number, level: number): IslandLayout {
  const side = islandSide(level);
  const h = (side - 1) / 2;
  const tiles = buildTerrain(seed, side);
  const blocks: Block[] = [];
  let depth = 0;
  let rise = 0;

  for (const { x, z, top, water } of tiles) {
    // Depth follows the smooth radius (no jitter) so the pyramid tip is never hidden behind the rim.
    const maxDepth = Math.ceil(config.island.coneSlope * h) + 1;
    let layers = 1 + Math.floor(((h + 0.5 - roundedRadius(x, z)) / (h + 0.5)) * maxDepth);
    const isCenter = x === 0 && z === 0;
    if (!isCenter && layers >= 3 && hash01(seed, x, z, 2) < config.island.columnShortenChance) layers -= 1;
    depth = Math.max(depth, layers);
    rise = Math.max(rise, top);

    // Base block at y = 0 (grass on level 1), then one half-height slab per extra level, grass on top.
    const slabs = Math.round(top / config.island.levelHeight);
    blocks.push({ x, z, y: 0, kind: slabs === 0 ? 'grass' : 'dirt', h: 1 });
    for (let i = 1; i <= slabs; i++) {
      const y = 0.5 + (i - 0.5) * config.island.levelHeight;
      blocks.push({ x, z, y, kind: i === slabs ? 'grass' : 'dirt', h: config.island.levelHeight });
    }
    if (water) {
      // Cut the stream bed: the top block loses `bedDepth` and turns to dirt.
      const bed = blocks[blocks.length - 1] as Block;
      bed.kind = 'dirt';
      bed.y -= config.stream.bedDepth / 2;
      bed.h -= config.stream.bedDepth;
    }
    for (let y = -1; y >= -layers; y--) {
      const k = -y;
      const stoneChance = k === 1 ? 0 : Math.min(0.85, 0.25 + 0.2 * (k - 1));
      const kind: BlockKind = hash01(seed, x, z, 10 + k) < stoneChance ? 'stone' : 'dirt';
      blocks.push({ x, z, y, kind, h: 1 });
    }
  }
  return { side, tiles, blocks, streams: runsOf(seed, side), depth, rise };
}

/** Campfire (center) and hut (one empty tile away along -x, door facing the fire). Animals are never placed here. */
export const FIRE_TILE: Tile = { x: 0, z: 0 };
export const HUT_TILE: Tile = { x: -2, z: 0 };
const RESERVED: readonly Tile[] = [FIRE_TILE, HUT_TILE];

/**
 * Picks a random empty tile, weighted toward the center (shared placement rule). Returns
 * `undefined` only if the island is completely full.
 */
export function pickPlacementTile(tiles: readonly (Tile & { water?: boolean })[], occupied: readonly Tile[], rng: Rng): Tile | undefined {
  return placeOnTiles(tiles, [...occupied, ...RESERVED], rng);
}
