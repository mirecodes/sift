import { describe, expect, it } from 'vitest';
import { arcPoint, MAX_CROSSING_S, moverPose, planIslandMove, stageAt, type MoverInput } from './islandMove';

const a = [3, 1, 0] as const;
const b = [8, 1, 0] as const;
const mover = (id: string, x: number): MoverInput => ({ id, from: [x, 1, 0], to: [10 + x, 1, 1] });
const plan = (n: number) =>
  planIslandMove({ a, b, unicorn: { id: 'u', from: [0, 1, 0], to: b }, movers: Array.from({ length: n }, (_, i) => mover(`m${i}`, -i * 0.3)) });

describe('island move timeline (Step 4.3)', () => {
  it('lasts about 12–15 s for a typical island and ends with nothing left on the old one', () => {
    for (const n of [5, 10, 20]) {
      const p = plan(n);
      expect(p.total, `${n} animals`).toBeGreaterThan(9);
      expect(p.total, `${n} animals`).toBeLessThanOrEqual(15.5);
      for (const m of p.movers) expect(moverPose(p, m, p.total).leg).toBe('arrived');
      expect(stageAt(p, p.total)).toMatchObject({ done: true, pan: 1, bridgeFrom: 1, unicornScale: 0 });
    }
  });

  it('keeps the crossing within 6 s even with many animals', () => {
    for (const n of [31, 100]) {
      const p = plan(n);
      const first = Math.min(...p.movers.map((m) => m.board));
      const last = Math.max(...p.movers.map((m) => m.land));
      expect(last - first).toBeLessThanOrEqual(MAX_CROSSING_S + 1e-9);
    }
  });

  it('sends the nearest animals first, single file', () => {
    const p = plan(4);
    expect(p.movers.map((m) => m.id)).toEqual(['m0', 'm1', 'm2', 'm3']);
    for (let i = 1; i < p.movers.length; i++) expect(p.movers[i]!.board).toBeGreaterThan(p.movers[i - 1]!.board);
  });

  it('moves continuously along the legs, the arch rising above both edges', () => {
    const p = plan(3);
    const m = p.movers[1]!;
    for (const t of [m.leave, m.board, m.land, m.arrive]) {
      const before = moverPose(p, m, t - 1e-6).pos;
      const after = moverPose(p, m, t + 1e-6).pos;
      expect(Math.hypot(before[0] - after[0], before[1] - after[1], before[2] - after[2])).toBeLessThan(1e-3);
    }
    expect(arcPoint(p, 0)).toEqual([...a]);
    expect(arcPoint(p, 1)).toEqual([...b]);
    expect(arcPoint(p, 0.5)[1]).toBeGreaterThan(2);
  });

  it('builds the bridge behind the leaping Unicorn, then dissolves it from the old end', () => {
    const p = plan(2);
    const u = p.unicorn!;
    expect(stageAt(p, u.board).bridgeTo).toBe(0);
    expect(stageAt(p, (u.board + u.land) / 2).bridgeTo).toBeCloseTo(0.5);
    expect(stageAt(p, u.land).bridgeTo).toBe(1);
    expect(stageAt(p, p.crossEnd).bridgeFrom).toBe(0);
    expect(stageAt(p, p.crossEnd + 0.6).bridgeFrom).toBeGreaterThan(0);
    // The new island is in place before anyone arrives; the old one sinks only after the last arrival.
    expect(stageAt(p, u.board).newLift).toBeCloseTo(0);
    expect(stageAt(p, p.crossEnd).oldLift).toBeCloseTo(0);
    expect(stageAt(p, p.total).oldLift).toBeLessThan(-10);
  });
});
