import { config } from '../config';
import type { Tile } from './island';
import { tileKey, type TileInfo, type TileKey } from './occupancy';

const STEPS: readonly Tile[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

/** Two neighbor tiles connect when both are walkable and their surfaces differ by at most one level. */
const connects = (a: TileInfo, b: TileInfo) => b.walkable && Math.abs(a.height - b.height) <= config.island.levelHeight + 1e-6;

/**
 * Grid A* for walking animals (guidance_v2 Step 3.12): 4-neighbor moves over walkable tiles (no
 * water except bridge tiles, no buildings, no camp), at most one level up or down per step. The start
 * and the goal may themselves be blocked (an animal leaving the cabin, a sleep spot by the camp).
 * Returns the tiles after `from` up to and including `to`, or null when no path exists.
 */
export function findPath(grid: ReadonlyMap<TileKey, TileInfo>, from: Tile, to: Tile): Tile[] | null {
  const start = grid.get(tileKey(from));
  const goal = grid.get(tileKey(to));
  if (!start || !goal) return null;
  if (start === goal) return [];
  const h = (t: Tile) => Math.abs(t.x - goal.x) + Math.abs(t.z - goal.z);
  const g = new Map<TileKey, number>([[tileKey(start), 0]]);
  const came = new Map<TileKey, TileKey>();
  // ponytail: linear-scan open list; islands have at most a few hundred tiles. Use a heap if that grows.
  const open: TileInfo[] = [start];
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      const fi = g.get(tileKey(open[i]!))! + h(open[i]!);
      const fb = g.get(tileKey(open[best]!))! + h(open[best]!);
      if (fi < fb || (fi === fb && h(open[i]!) < h(open[best]!))) best = i;
    }
    const cur = open.splice(best, 1)[0]!;
    const curKey = tileKey(cur);
    if (cur === goal) {
      const path: Tile[] = [];
      for (let k: TileKey | undefined = curKey; k && k !== tileKey(start); k = came.get(k)) {
        const t = grid.get(k)!;
        path.push({ x: t.x, z: t.z });
      }
      return path.reverse();
    }
    for (const s of STEPS) {
      const next = grid.get(tileKey({ x: cur.x + s.x, z: cur.z + s.z }));
      if (!next) continue;
      const ok = next === goal ? Math.abs(cur.height - next.height) <= config.island.levelHeight + 1e-6 : connects(cur, next);
      if (!ok) continue;
      const key = tileKey(next);
      const cost = g.get(curKey)! + 1;
      if (cost < (g.get(key) ?? Infinity)) {
        g.set(key, cost);
        came.set(key, curKey);
        if (!open.includes(next)) open.push(next);
      }
    }
  }
  return null;
}
