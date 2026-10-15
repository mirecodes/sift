import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { seededRng } from '../random';
import { CAMP_RESERVED, COIN_PILE_TILE, FIRE_TILE, generateIsland, HUT_TILE, islandSide, islandTiles, pickPlacementTile } from './island';

describe('islandSide', () => {
  it('starts at 7 and grows with animal count, always odd', () => {
    expect(islandSide(0)).toBe(7);
    expect(islandSide(16)).toBe(7); // 48 tiles -> ceil(sqrt) = 7
    expect(islandSide(17)).toBe(9); // 51 -> 8 -> 9
    expect(islandSide(100)).toBe(19); // 300 -> 18 -> 19
    for (let n = 0; n < 300; n++) {
      expect(islandSide(n) % 2).toBe(1);
      expect(islandSide(n + 1)).toBeGreaterThanOrEqual(islandSide(n));
    }
  });
});

describe('generateIsland', () => {
  it('is deterministic for the same seed and count', () => {
    expect(generateIsland(42, 17)).toEqual(generateIsland(42, 17));
  });

  it('differs between seeds', () => {
    expect(islandTiles(1, 15)).not.toEqual(islandTiles(2, 15));
  });

  it('is monotone: tiles never disappear as the island grows', () => {
    for (const seed of [1, 7, 123456]) {
      let prev = new Set(islandTiles(seed, 7).map((t) => `${t.x},${t.z}`));
      for (const side of [9, 11, 15, 19, 25]) {
        const next = new Set(islandTiles(seed, side).map((t) => `${t.x},${t.z}`));
        for (const k of prev) expect(next.has(k)).toBe(true);
        prev = next;
      }
    }
  });

  it('always has plenty of free tiles and keeps the center', () => {
    for (let n = 0; n <= 200; n++) {
      const island = generateIsland(99, n);
      expect(island.tiles.some((t) => t.x === 0 && t.z === 0)).toBe(true);
      expect(island.tiles.length).toBeGreaterThanOrEqual(n + 5);
    }
  });

  it('rounds the corners of large islands', () => {
    const island = generateIsland(5, 100);
    const h = (island.side - 1) / 2;
    expect(island.tiles.some((t) => t.x === h && t.z === h)).toBe(false);
    expect(island.tiles.length).toBeLessThan(island.side * island.side);
  });

  it('has a grass surface, and no block floats over a gap', () => {
    const island = generateIsland(11, 30);
    const byColumn = new Map<string, typeof island.blocks>();
    for (const b of island.blocks) {
      const k = `${b.x},${b.z}`;
      byColumn.set(k, [...(byColumn.get(k) ?? []), b]);
    }
    for (const [k, col] of byColumn) {
      const cell = island.tiles.find((t) => `${t.x},${t.z}` === k)!;
      const sorted = [...col].sort((a, b) => b.y - a.y);
      // Blocks stack edge to edge from the surface (top + 0.5) down, and only the highest is grass.
      // A stream bed is cut down by `bedDepth` and is dirt.
      let edge = cell.top + 0.5 - (cell.water ? config.stream.bedDepth : 0);
      sorted.forEach((b, i) => {
        expect(b.y + b.h / 2).toBeCloseTo(edge);
        expect(b.kind === 'grass').toBe(i === 0 && !cell.water);
        edge -= b.h;
      });
    }
    expect(byColumn.size).toBe(island.tiles.length);
  });

  it('is near-circular: no corner tiles, tiles stay within the circle', () => {
    for (const seed of [1, 2, 3]) {
      const { tiles, side } = generateIsland(seed, 0);
      expect(side).toBe(7);
      expect(tiles.some((t) => Math.abs(t.x) === 3 && Math.abs(t.z) === 3)).toBe(false);
      for (const t of tiles) expect(Math.hypot(t.x, t.z)).toBeLessThanOrEqual(3.5);
    }
  });

  it('puts the hut one empty tile from the fire, door toward the fire', () => {
    expect(HUT_TILE.z).toBe(FIRE_TILE.z);
    expect(FIRE_TILE.x - HUT_TILE.x).toBe(2);
    for (const seed of [1, 2, 3, 42]) {
      const { tiles } = generateIsland(seed, 0);
      expect(tiles.some((t) => t.x === HUT_TILE.x && t.z === HUT_TILE.z)).toBe(true);
    }
  });

  it('narrows downward like an inverted pyramid', () => {
    const island = generateIsland(3, 60);
    const count = (y: number) => island.blocks.filter((b) => b.y === y).length;
    expect(count(-1)).toBeGreaterThan(count(-2));
    expect(count(-2)).toBeGreaterThan(count(-island.depth));
  });
});

describe('pickPlacementTile', () => {
  const tiles = islandTiles(1, 7);

  it('never picks an occupied tile and returns undefined when full', () => {
    const rng = seededRng(1);
    const occupied: { x: number; z: number }[] = [];
    // Every tile except the camp (campfire, hut, coin pile) and the stream is free.
    for (let i = 0; i < tiles.filter((t) => !t.water).length - CAMP_RESERVED.length; i++) {
      const t = pickPlacementTile(tiles, occupied, rng);
      expect(t).toBeDefined();
      expect(occupied.some((o) => o.x === t!.x && o.z === t!.z)).toBe(false);
      occupied.push(t!);
    }
    expect(pickPlacementTile(tiles, occupied, rng)).toBeUndefined();
  });

  it('never uses the campfire, hut or coin pile tile', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 200; i++) {
      const t = pickPlacementTile(tiles, [], rng)!;
      expect([FIRE_TILE, HUT_TILE, COIN_PILE_TILE].some((r) => r.x === t.x && r.z === t.z)).toBe(false);
    }
  });

  it('prefers tiles near the center', () => {
    const rng = seededRng(7);
    let inner = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const t = pickPlacementTile(tiles, [], rng)!;
      if (Math.abs(t.x) <= 1 && Math.abs(t.z) <= 1) inner++;
    }
    // 9 of ~45 tiles are in the inner 3x3; a uniform pick would give ~20%.
    expect(inner / n).toBeGreaterThan(0.3);
  });
});

describe('terrain', () => {
  const seeds = [1, 2, 3, 42, 99, 12345, 777, 31337, ...Array.from({ length: 100 }, (_, i) => i * 104729 + 5)];
  
  it('keeps heights in 1..3 and rises toward the back', () => {
    for (const seed of seeds) {
      const { tiles } = generateIsland(seed, 100);
      for (const t of tiles) expect(t.top).toBeGreaterThanOrEqual(0);
      for (const t of tiles) expect(t.top).toBeLessThanOrEqual(1); // level 3 = 2 × 0.5 block
      const land = tiles;
      const mean = (f: (t: (typeof land)[0]) => boolean) => {
        const s = land.filter(f);
        return s.reduce((a, t) => a + t.top, 0) / s.length;
      };
      expect(mean((t) => t.x + t.z < -3)).toBeGreaterThan(mean((t) => t.x + t.z > 3));
    }
  });

  it('keeps the ground around the camp flat and mixes plains with hills', () => {
    const many = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
    let hills = 0;
    let lows = 0;
    let plains = 0;
    let total = 0;
    for (const seed of many) {
      for (const t of generateIsland(seed, 100).tiles) {
        if (!t.water && Math.hypot(t.x - (HUT_TILE.x + FIRE_TILE.x) / 2, t.z) <= 2.5) expect(t.top).toBe(0.5);
        total++;
        if (t.top > 0.5) hills++;
        else if (t.top < 0.5) lows++;
        else plains++;
      }
    }
    expect(plains / total).toBeGreaterThan(0.4);
    expect(hills / total).toBeGreaterThan(0.08);
    expect(lows / total).toBeGreaterThan(0.03);
  });

  it('never leaves a cliff taller than one block between adjacent land tiles', () => {
    for (const seed of seeds) {
      const { tiles } = generateIsland(seed, 100);
      const at = new Map(tiles.map((t) => [`${t.x},${t.z}`, t]));
      for (const t of tiles) {
        for (const n of [at.get(`${t.x + 1},${t.z}`), at.get(`${t.x},${t.z + 1}`)]) {
          if (n) expect(Math.abs(n.top - t.top)).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });
});
