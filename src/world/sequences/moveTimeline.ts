/**
 * Island move sequence timeline (guidance_v2 Step 4.3, DESIGN.md 18): pure timing and paths, driven by
 * data that is already saved. Times in seconds from the start; points in the scene's world space.
 *
 * 1. Reveal: the new island rises into place beside the old one.
 * 2. Rainbow bridge: the Unicorn walks to the edge and leaps across; the bridge forms behind it.
 * 3. Crossing: the others walk across single file, nearest first (at most `MAX_CROSSING_S`).
 * 4. Arrival: they hop off to their new tiles; the Unicorn dissolves at the far end.
 * 5. Farewell: the bridge dissolves from the old end, the old island sinks, the view pans to the new one.
 */

export type Vec3 = readonly [number, number, number];

export const REVEAL_S = 1.5;
const UNICORN_WALK_S = 0.8;
const UNICORN_LEAP_S = 2;
const UNICORN_FADE_S = 0.5;
/** Time one animal spends on the bridge. */
const BRIDGE_S = 1.6;
/** From the first animal stepping on the bridge to the last stepping off. */
export const MAX_CROSSING_S = 6;
const GAP_S = 0.45;
const WALK = 1.6; // blocks per second
const ARRIVE_MAX_S = 1.5;
const DISSOLVE_S = 1.2;
const FAREWELL_S = 2.2;
const END_PAUSE_S = 0.3;
/** How far the new island starts below its place, and the old one sinks. */
export const REVEAL_RISE = -5;
const RISE_FROM = REVEAL_RISE;
const SINK_TO = -14;

export interface MoverInput {
  id: string;
  from: Vec3;
  to: Vec3;
}

export interface MoverPlan extends MoverInput {
  /** Leaves its old tile. */
  leave: number;
  /** Steps on the bridge. */
  board: number;
  /** Steps off the bridge. */
  land: number;
  /** Reaches its new tile. */
  arrive: number;
}

export interface MovePlan {
  /** Bridge ends: the old island's edge and the new island's edge. */
  a: Vec3;
  b: Vec3;
  /** Top of the arch (quadratic Bezier control point). */
  control: Vec3;
  unicorn: (MoverPlan & { fadeEnd: number }) | null;
  movers: MoverPlan[];
  /** Last arrival: the farewell starts here. */
  crossEnd: number;
  total: number;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (p: Vec3, q: Vec3, t: number): Vec3 => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
const dist = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[2] - q[2]);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function planIslandMove(input: { a: Vec3; b: Vec3; unicorn: MoverInput | null; movers: readonly MoverInput[] }): MovePlan {
  const { a, b } = input;
  const span = dist(a, b);
  const control: Vec3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 1.5 + span * 0.25, (a[2] + b[2]) / 2];

  const leap = REVEAL_S + UNICORN_WALK_S;
  const unicorn = input.unicorn && {
    ...input.unicorn,
    leave: REVEAL_S,
    board: leap,
    land: leap + UNICORN_LEAP_S,
    arrive: leap + UNICORN_LEAP_S,
    fadeEnd: leap + UNICORN_LEAP_S + UNICORN_FADE_S,
  };

  // Nearest to the bridge first; the gap shrinks with many animals so the crossing fits.
  const order = [...input.movers].sort((p, q) => dist(p.from, a) - dist(q.from, a) || p.id.localeCompare(q.id));
  const n = order.length;
  const gap = n > 1 ? Math.min(GAP_S, (MAX_CROSSING_S - BRIDGE_S) / (n - 1)) : 0;
  const first = leap + UNICORN_LEAP_S;
  const movers = order.map((m, i): MoverPlan => {
    const board = first + i * gap;
    const leave = Math.max(REVEAL_S, board - dist(m.from, a) / WALK);
    const land = board + BRIDGE_S;
    return { ...m, leave, board, land, arrive: land + Math.min(ARRIVE_MAX_S, Math.max(0.3, dist(b, m.to) / WALK)) };
  });

  const crossEnd = Math.max(unicorn?.fadeEnd ?? 0, ...movers.map((m) => m.arrive), first);
  return { a, b, control, unicorn, movers, crossEnd, total: crossEnd + FAREWELL_S + END_PAUSE_S };
}

/** Point on the bridge arch at `u` (0 = old edge, 1 = new edge). */
export function arcPoint(plan: Pick<MovePlan, 'a' | 'b' | 'control'>, u: number): Vec3 {
  const { a, b, control: c } = plan;
  const k = 1 - u;
  return [k * k * a[0] + 2 * k * u * c[0] + u * u * b[0], k * k * a[1] + 2 * k * u * c[1] + u * u * b[1], k * k * a[2] + 2 * k * u * c[2] + u * u * b[2]];
}

export type Leg = 'home' | 'toBridge' | 'bridge' | 'arriving' | 'arrived';

/** Where an animal is at `t`, and which leg it is on (`home` on the old island, `arrived` on the new). */
export function moverPose(plan: Pick<MovePlan, 'a' | 'b' | 'control'>, m: MoverPlan, t: number): { pos: Vec3; leg: Leg; heading: Vec3 } {
  if (t <= m.leave) return { pos: m.from, leg: 'home', heading: [plan.a[0] - m.from[0], 0, plan.a[2] - m.from[2]] };
  if (t < m.board) return { pos: lerp3(m.from, plan.a, (t - m.leave) / (m.board - m.leave)), leg: 'toBridge', heading: [plan.a[0] - m.from[0], 0, plan.a[2] - m.from[2]] };
  if (t < m.land) {
    const u = (t - m.board) / (m.land - m.board);
    const p = arcPoint(plan, u);
    const q = arcPoint(plan, Math.min(1, u + 0.02));
    return { pos: p, leg: 'bridge', heading: [q[0] - p[0], 0, q[2] - p[2]] };
  }
  if (t < m.arrive) return { pos: lerp3(plan.b, m.to, (t - m.land) / (m.arrive - m.land)), leg: 'arriving', heading: [m.to[0] - plan.b[0], 0, m.to[2] - plan.b[2]] };
  return { pos: m.to, leg: 'arrived', heading: [m.to[0] - plan.b[0], 0, m.to[2] - plan.b[2]] };
}

/** Island and bridge state at `t`: island lifts, the view pan (0 = both, 1 = the new island), the visible bridge span. */
export function stageAt(plan: MovePlan, t: number) {
  const farewell = clamp01((t - plan.crossEnd) / FAREWELL_S);
  const unicorn = plan.unicorn;
  return {
    newLift: RISE_FROM * (1 - easeOut(clamp01(t / REVEAL_S))),
    oldLift: SINK_TO * farewell * farewell,
    pan: easeInOut(farewell),
    /** The bridge is drawn from `bridgeFrom` to `bridgeTo` along the arch. */
    bridgeFrom: clamp01((t - plan.crossEnd) / DISSOLVE_S),
    bridgeTo: unicorn ? clamp01((t - unicorn.board) / (unicorn.land - unicorn.board)) : clamp01(t / REVEAL_S),
    /** 1 → 0 while the Unicorn dissolves at the far end. */
    unicornScale: unicorn ? 1 - clamp01((t - unicorn.land) / (unicorn.fadeEnd - unicorn.land)) : 0,
    done: t >= plan.total,
  };
}
