import { describe, expect, it } from 'vitest';
import type { TileInfo, TileKey } from './occupancy';
import { findPath } from './path';

/**
 * A small hand-made grid. Legend: `.` land (level 1), `^` land one level up, `#` two levels up,
 * `B` building, `~` water, `=` bridge over water, `C` camp.
 */
function grid(rows: string[]): Map<TileKey, TileInfo> {
  const out = new Map<TileKey, TileInfo>();
  rows.forEach((row, z) =>
    [...row].forEach((c, x) => {
      const water = c === '~' || c === '=';
      const blocked = c === 'B' || c === '~' || c === 'C';
      out.set(`${x},${z}`, {
        x, z, water, campReserved: c === 'C', animalIds: [], buildable: false,
        height: c === '^' ? 0.5 : c === '#' ? 1 : 0,
        walkable: !blocked,
        ...(c === '=' && { bridge: true }),
        ...(c === 'B' && { buildingId: 'b' }),
      });
    }),
  );
  return out;
}
const len = (p: unknown[] | null) => p?.length;

describe('findPath (Step 3.12)', () => {
  it('walks straight when nothing is in the way', () => {
    expect(findPath(grid(['....']), { x: 0, z: 0 }, { x: 3, z: 0 })).toEqual([{ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }]);
    expect(findPath(grid(['..']), { x: 0, z: 0 }, { x: 0, z: 0 })).toEqual([]);
  });

  it('goes around buildings, camp and water', () => {
    const g = grid(['.....', '.BBB.', '.....']);
    const p = findPath(g, { x: 0, z: 1 }, { x: 4, z: 1 });
    expect(len(p)).toBe(6);
    for (const t of p!) expect(g.get(`${t.x},${t.z}`)!.walkable).toBe(true);
    expect(len(findPath(grid(['.~.', '.~.', '...']), { x: 0, z: 0 }, { x: 2, z: 0 }))).toBe(6);
    expect(len(findPath(grid(['.C.', '...']), { x: 0, z: 0 }, { x: 2, z: 0 }))).toBe(4);
  });

  it('crosses water only over a bridge', () => {
    expect(findPath(grid(['.=.', '.~.']), { x: 0, z: 1 }, { x: 2, z: 1 })).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }]);
  });

  it('climbs one level at a time, never two', () => {
    expect(len(findPath(grid(['.^#']), { x: 0, z: 0 }, { x: 2, z: 0 }))).toBe(2);
    expect(findPath(grid(['.#.']), { x: 0, z: 0 }, { x: 2, z: 0 })).toBeNull();
    // Around the cliff over the one-level step in the middle row.
    expect(findPath(grid(['.#.', '.^.', '...']), { x: 0, z: 0 }, { x: 2, z: 0 })).toEqual([{ x: 0, z: 1 }, { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 0 }]);
  });

  it('may start or end on a blocked tile (cabin door, camp spots), never pass through one', () => {
    expect(findPath(grid(['C..']), { x: 0, z: 0 }, { x: 2, z: 0 })).toEqual([{ x: 1, z: 0 }, { x: 2, z: 0 }]);
    expect(findPath(grid(['..C']), { x: 0, z: 0 }, { x: 2, z: 0 })).toEqual([{ x: 1, z: 0 }, { x: 2, z: 0 }]);
    expect(findPath(grid(['.B.']), { x: 0, z: 0 }, { x: 2, z: 0 })).toBeNull();
  });

  it('returns null when walled in or off the island', () => {
    expect(findPath(grid(['.B.', 'BB.', '...']), { x: 0, z: 0 }, { x: 2, z: 2 })).toBeNull();
    expect(findPath(grid(['..']), { x: 0, z: 0 }, { x: 9, z: 9 })).toBeNull();
  });
});
