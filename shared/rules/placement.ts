import { balance } from '../balance/balance';
import type { Rng } from '../rng';

export interface Tile {
  x: number;
  z: number;
}

const key = (t: Tile): string => `${t.x},${t.z}`;

/**
 * Picks a random tile from `tiles` that is not water and not in `blocked`, weighted toward
 * the center. Returns `undefined` only if no tile is free.
 */
export function pickPlacementTile(tiles: readonly (Tile & { water?: boolean })[], blocked: readonly Tile[], rng: Rng): Tile | undefined {
  const taken = new Set(blocked.map(key));
  const free = tiles.filter((t) => !t.water && !taken.has(key(t)));
  if (free.length === 0) return undefined;

  const bias = balance.placement.centerBias;
  const weights = free.map((t) => 1 / (1 + bias * (t.x * t.x + t.z * t.z)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < free.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return free[i];
  }
  return free[free.length - 1];
}
