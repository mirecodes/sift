import type { WarView } from '../../../shared/api/types';

/**
 * The battle replay as a pure timeline (guidance_v2 Step 9.6, reworked by the owner 2026-11-04): the ship
 * sails in with the attackers on deck, they hop onto the island one by one in waves, and the stored
 * duels play all over the island. Each duel starts at its step's time plus a small per-duel offset, and
 * never before both animals are free, so fights overlap instead of ticking in rounds. The whole battle is
 * squeezed to at most `BATTLE_MAX_S`. Poses and effects are functions of time only (Skip, 2×).
 */
export const VOYAGE_S = 3.5;
export const BATTLE_MAX_S = 26;
export const RESULT_HOLD_S = 1.2;
/** A landing wave and a battle step (before squeezing). */
const STEP_S = 0.95;
const HOP_S = 0.55;
/** Tiles per second while running to a duel. */
const RUN = 3;
/** Clash: two exchanged hits, then the blow. */
const HIT1 = 0.12;
const HIT2 = 0.38;
const BLOW = 0.62;
const FALL_S = 0.4;
const POOF_S = 0.2;
const FADE_S = 0.7;
/** The squeeze never goes below this (fights stay readable; very long battles run a little longer). */
const MIN_SQUEEZE = 0.4;
/** The ship model's scale; its deck height above its origin; deck slots are spread over this area (ship space). */
export const SHIP_SCALE = 0.85;
export const DECK_Y = 0.45 * SHIP_SCALE;
const DECK_X: [number, number] = [-1.6 * SHIP_SCALE, 2 * SHIP_SCALE];
const DECK_Z = 0.5 * SHIP_SCALE;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface DuelPlan {
  start: number;
  hit1: number;
  hit2: number;
  blow: number;
  /** When the winner is free again. */
  end: number;
  from: Vec2;
  /** Where this animal clashes; `foe` = where the other one does. */
  at: Vec2;
  foe: Vec2;
  lost: boolean;
}

export interface FighterPlan {
  id: string;
  side: 'attacker' | 'defender';
  speciesId: string;
  skinId?: string;
  /** Island tile it starts on (defenders) or lands on (attackers). */
  start: Vec2;
  /** Attackers: offset on the deck and the hop down. */
  deck?: Vec2;
  hop?: { start: number; end: number };
  duels: DuelPlan[];
  vanished: boolean;
  protected: boolean;
}

export type EffectKind = 'hit' | 'blow' | 'poof' | 'down' | 'land' | 'shield' | 'trail';
export interface Effect {
  t: number;
  kind: EffectKind;
  x: number;
  y: number;
  z: number;
}

export interface WarPlan {
  fighters: FighterPlan[];
  effects: Effect[];
  /** Defending Unicorns: their aura shimmers until they fall. */
  auras: { x: number; z: number; until: number }[];
  battleStart: number;
  battleEnd: number;
  total: number;
  dock: Vec3;
  /** The ship's bow direction (unit, world x/z): it sails in along it and leaves along it. */
  heading: Vec2;
  heightAt: (x: number, z: number) => number;
}

export interface PlanOptions {
  /** Where the ship's origin hovers while the attackers land. */
  dock?: Vec3;
  /** The ship's bow direction; default +x. */
  heading?: Vec2;
  /** Ground height (the walkable surface) at a position. */
  heightAt?: (x: number, z: number) => number;
  /** Nearest land tile (older wars stored attackers off the island). */
  land?: (x: number, z: number) => Vec2;
}

/** A stable value in [0, 1) for a string (per-duel offsets, effect spreads). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => 1 - (1 - k) ** 2;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const towards = (a: Vec2, b: Vec2, d: number): Vec2 => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) / len) * d, a[1] + ((b[1] - a[1]) / len) * d];
};

export function planWar(war: Pick<WarView, 'attackers' | 'defenders' | 'rounds' | 'vanished' | 'protected'>, opts: PlanOptions = {}): WarPlan {
  const heightAt = opts.heightAt ?? (() => 0);
  const dock: Vec3 = opts.dock ?? [0, 1, 6];
  const heading: Vec2 = opts.heading ?? [1, 0];
  const vanished = new Set(war.vanished);
  const shielded = new Set(war.protected ?? []);
  const pos = new Map<string, Vec2>();
  const fighters = new Map<string, FighterPlan>();
  const freeAt = new Map<string, number>();
  const effects: Effect[] = [];

  // Attackers: deck slots, then waves of hops (highest ranks first, as stored).
  const attackers = war.attackers.map((f, i) => ({ f, i, wave: f.landAt ?? 0 }));
  const waves = new Map<number, typeof attackers>();
  for (const a of attackers) waves.set(a.wave, [...(waves.get(a.wave) ?? []), a]);
  const cols = Math.max(1, Math.ceil(Math.sqrt(attackers.length * 2.5)));
  for (const { f, i, wave } of attackers) {
    const start: Vec2 = f.landAt === undefined && opts.land ? opts.land(f.x, f.z) : [f.x, f.z];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rows = Math.max(1, Math.ceil(attackers.length / cols));
    const deck: Vec2 = [lerp(DECK_X[0], DECK_X[1], cols === 1 ? 0.5 : col / (cols - 1)), rows === 1 ? 0 : lerp(-DECK_Z, DECK_Z, row / (rows - 1))];
    const inWave = waves.get(wave)!;
    const j = inWave.findIndex((x) => x.f.id === f.id);
    const hopStart = VOYAGE_S + wave * STEP_S + (j / Math.max(1, inWave.length)) * STEP_S * 0.8 + hash01(`hop${f.id}`) * 0.05;
    fighters.set(f.id, { id: f.id, side: 'attacker', speciesId: f.speciesId, ...(f.skinId && { skinId: f.skinId }), start, deck, hop: { start: hopStart, end: hopStart + HOP_S }, duels: [], vanished: vanished.has(f.id), protected: false });
    pos.set(f.id, start);
    freeAt.set(f.id, hopStart + HOP_S + 0.05);
  }
  for (const f of war.defenders) {
    fighters.set(f.id, { id: f.id, side: 'defender', speciesId: f.speciesId, ...(f.skinId && { skinId: f.skinId }), start: [f.x, f.z], duels: [], vanished: vanished.has(f.id), protected: shielded.has(f.id) });
    pos.set(f.id, [f.x, f.z]);
    freeAt.set(f.id, VOYAGE_S);
  }

  // Duels: the step's time plus an offset, never before both are free.
  war.rounds.forEach((round, r) => {
    const base = VOYAGE_S + r * STEP_S + HOP_S + 0.1;
    for (const duel of round.duels) {
      const a = fighters.get(duel.a);
      const d = fighters.get(duel.d);
      if (!a || !d) continue;
      const pa = pos.get(a.id)!;
      const pd = pos.get(d.id)!;
      const meet: Vec2 = duel.meet;
      const start = Math.max(base + hash01(`${duel.a}|${duel.d}|${r}`) * STEP_S * 0.75, freeAt.get(a.id)!, freeAt.get(d.id)!);
      const run = Math.min(0.9, Math.max(0.15, Math.max(Math.hypot(meet[0] - pa[0], meet[1] - pa[1]), Math.hypot(meet[0] - pd[0], meet[1] - pd[1])) / RUN));
      const clash = start + run;
      // They stand a little apart at the meeting point, facing each other.
      const atA = towards(meet, pa, 0.22);
      const atD = towards(meet, pd, 0.22);
      for (const [f, from, at, foe] of [
        [a, pa, atA, atD],
        [d, pd, atD, atA],
      ] as const) {
        f.duels.push({ start, hit1: clash + HIT1, hit2: clash + HIT2, blow: clash + BLOW, end: clash + BLOW + 0.2, from, at, foe, lost: duel.loser === f.id });
      }
      const winner = duel.loser === a.id ? d : a;
      const loser = winner === a ? d : a;
      pos.set(winner.id, winner === a ? atA : atD);
      freeAt.set(winner.id, clash + BLOW + 0.2);
      freeAt.set(loser.id, Infinity);
      const mid = (p: Vec2, q: Vec2): Vec2 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const c = mid(atA, atD);
      const y = heightAt(c[0], c[1]) + 0.25;
      effects.push({ t: clash + HIT1, kind: 'hit', x: c[0], y, z: c[1] }, { t: clash + HIT2, kind: 'hit', x: c[0], y, z: c[1] }, { t: clash + BLOW, kind: 'blow', x: c[0], y, z: c[1] });
      const lp = loser === a ? atA : atD;
      const ly = heightAt(lp[0], lp[1]);
      if (loser.vanished) effects.push({ t: clash + BLOW + FALL_S, kind: 'poof', x: lp[0], y: ly + 0.2, z: lp[1] });
      else {
        effects.push({ t: clash + BLOW + FALL_S, kind: 'down', x: lp[0], y: ly + 0.05, z: lp[1] });
        if (loser.protected) effects.push({ t: clash + BLOW + FALL_S, kind: 'shield', x: lp[0], y: ly + 0.3, z: lp[1] });
      }
    }
  });
  for (const f of fighters.values())
    if (f.hop) effects.push({ t: f.hop.end, kind: 'land', x: f.start[0], y: heightAt(f.start[0], f.start[1]) + 0.02, z: f.start[1] });

  // Squeeze everything after the voyage so the battle fits.
  const lastDuel = Math.max(VOYAGE_S, ...[...fighters.values()].flatMap((f) => f.duels.map((d) => d.blow + FALL_S + (f.vanished ? POOF_S : FADE_S))));
  const lastHop = Math.max(VOYAGE_S, ...[...fighters.values()].map((f) => f.hop?.end ?? 0));
  const span = Math.max(lastDuel, lastHop) - VOYAGE_S;
  const k = span > BATTLE_MAX_S ? Math.max(MIN_SQUEEZE, BATTLE_MAX_S / span) : 1;
  const sq = (t: number) => (t <= VOYAGE_S ? t : VOYAGE_S + (t - VOYAGE_S) * k);
  for (const f of fighters.values()) {
    if (f.hop) f.hop = { start: sq(f.hop.start), end: sq(f.hop.end) };
    f.duels = f.duels.map((d) => ({ ...d, start: sq(d.start), hit1: sq(d.hit1), hit2: sq(d.hit2), blow: sq(d.blow), end: sq(d.end) }));
  }
  for (const e of effects) e.t = sq(e.t);
  const battleEnd = sq(Math.max(lastDuel, lastHop));
  // The ship leaves a cloud trail while it sails in.
  for (let t = 0.2; t < VOYAGE_S - 0.3; t += 0.18) {
    const [x, y, z] = shipAt({ battleEnd, dock, heading }, t).position;
    const side = (hash01(`trail${t}`) - 0.5) * 0.8;
    effects.push({ t, kind: 'trail', x: x - heading[0] * 2.4 - heading[1] * side, y: y - 0.1, z: z - heading[1] * 2.4 + heading[0] * side });
  }
  effects.sort((a, b) => a.t - b.t);
  const auras = war.defenders
    .filter((f) => f.speciesId === 'unicorn')
    .map((u) => {
      const own = fighters.get(u.id)!;
      const lost = own.duels.find((d) => d.lost);
      return { x: u.x, z: u.z, until: lost ? lost.blow : Infinity };
    });
  return { fighters: [...fighters.values()], effects, auras, battleStart: VOYAGE_S, battleEnd, total: battleEnd + RESULT_HOLD_S, dock, heading, heightAt };
}

/** A point given in ship space (x along the bow, z to port) in world x/z, relative to the ship. */
export const shipToWorld = (heading: Vec2, local: Vec2): Vec2 => [local[0] * heading[0] - local[1] * heading[1], local[0] * heading[1] + local[1] * heading[0]];

export interface Pose {
  x: number;
  /** Absolute height of the animal's feet. */
  y: number;
  z: number;
  /** Facing, radians around y (0 = +z). */
  yaw: number;
  /** Tipping over, radians. */
  tilt: number;
  /** 0 hidden … 1 full size. */
  scale: number;
  /** Squash and stretch (1 = none): >1 wider and lower. */
  squash: number;
  /** Hit flash, 0 … 1. */
  flash: number;
}

const faceTo = (from: Vec2, to: Vec2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
/** A quick lunge (0 → 1 → 0) around `t0`. */
const pulse = (t: number, t0: number, w: number) => (Math.abs(t - t0) < w ? Math.cos(((t - t0) / w) * (Math.PI / 2)) : 0);

/** Where a fighter is at time `t` (seconds from the start of the replay). */
export function poseAt(plan: WarPlan, f: FighterPlan, t: number): Pose {
  const ground = (p: Vec2) => plan.heightAt(p[0], p[1]);
  // On deck while sailing, then the hop down.
  if (f.hop && f.deck && t < f.hop.end) {
    const ship = shipAt(plan, Math.min(t, f.hop.start)).position;
    const off = shipToWorld(plan.heading, f.deck);
    const deck: Vec3 = [ship[0] + off[0], ship[1] + DECK_Y, ship[2] + off[1]];
    const yaw = faceTo([deck[0], deck[2]], f.start);
    if (t < f.hop.start) return { x: deck[0], y: deck[1] + Math.abs(Math.sin(t * 5 + hash01(f.id) * 6)) * 0.03, z: deck[2], yaw: t < VOYAGE_S ? Math.atan2(plan.heading[0], plan.heading[1]) : yaw, tilt: 0, scale: 1, squash: 1, flash: 0 };
    const k = clamp01((t - f.hop.start) / (f.hop.end - f.hop.start));
    const end = ground(f.start);
    const dist = Math.hypot(f.start[0] - deck[0], f.start[1] - deck[2]);
    const arc = 4 * (0.7 + dist * 0.12) * k * (1 - k);
    return { x: lerp(deck[0], f.start[0], k), y: lerp(deck[1], end, k) + arc, z: lerp(deck[2], f.start[1], k), yaw, tilt: 0, scale: 1, squash: k < 0.15 ? 1.15 : 1, flash: 0 };
  }

  let at: Vec2 = f.start;
  let yaw = f.side === 'attacker' ? faceTo(f.start, [0, 0]) : 0;
  for (const d of f.duels) {
    if (t < d.start) break;
    const face = faceTo(d.at, d.foe);
    if (t < d.hit1 - 0.12) {
      // Run in, with small bounding hops.
      const k = ease(clamp01((t - d.start) / Math.max(0.01, d.hit1 - 0.12 - d.start)));
      const p: Vec2 = [lerp(d.from[0], d.at[0], k), lerp(d.from[1], d.at[1], k)];
      return { x: p[0], y: ground(p) + Math.abs(Math.sin(k * Math.PI * 3)) * 0.1, z: p[1], yaw: face, tilt: 0, scale: 1, squash: 1, flash: 0 };
    }
    if (t < d.blow + (d.lost ? 0 : 0.2)) {
      // The exchange: the first hit lands on the winner, the second and the blow on the loser.
      const takes = d.lost ? pulse(t, d.hit2, 0.14) + pulse(t, d.blow, 0.16) : pulse(t, d.hit1, 0.14);
      const gives = d.lost ? pulse(t, d.hit1 - 0.03, 0.12) : pulse(t, d.hit2 - 0.03, 0.12) + pulse(t, d.blow - 0.03, 0.12);
      const p = towards(d.at, d.foe, gives * 0.16 - takes * 0.1);
      return { x: p[0], y: ground(d.at) + gives * 0.06, z: p[1], yaw: face, tilt: -takes * 0.25, scale: 1, squash: 1 + gives * 0.18 - takes * 0.1, flash: takes };
    }
    if (d.lost) {
      // Knocked back and over; then a poof (left for good) or it sinks away (back home).
      const kb = clamp01((t - d.blow) / FALL_S);
      const p = towards(d.at, d.foe, -0.35 * ease(kb));
      const y = ground(d.at) + Math.sin(kb * Math.PI) * 0.18;
      const over = { x: p[0], y, z: p[1], yaw: face, tilt: -ease(kb) * (Math.PI / 2), squash: 1 };
      if (kb < 1) return { ...over, scale: 1, flash: clamp01(1 - kb * 3) };
      const gone = f.vanished ? clamp01((t - d.blow - FALL_S) / POOF_S) : clamp01((t - d.blow - FALL_S - 0.3) / (FADE_S - 0.3));
      return { ...over, scale: 1 - gone, flash: 0 };
    }
    // The winner: a small victory hop.
    const v = clamp01((t - d.blow - 0.2) / 0.3);
    at = d.at;
    yaw = face;
    if (v < 1) return { x: at[0], y: ground(at) + Math.sin(v * Math.PI) * 0.12, z: at[1], yaw, tilt: 0, scale: 1, squash: 1, flash: 0 };
  }
  // Idle: a gentle breath.
  const breath = Math.sin(t * 3 + hash01(f.id) * 6.28) * 0.02;
  return { x: at[0], y: ground(at), z: at[1], yaw, tilt: 0, scale: 1, squash: 1 + breath, flash: 0 };
}

/**
 * The ship: sails in from the left, high, and settles beside the island's front edge; it rides the air
 * (bob, roll) while docked, then sails off after the result.
 */
export function shipAt(plan: Pick<WarPlan, 'battleEnd' | 'dock' | 'heading'>, t: number): { position: Vec3; rotation: Vec3; visible: boolean } {
  const [dx, dy, dz] = plan.dock;
  const [hx, hz] = plan.heading;
  // Rotation order YXZ: yaw to the heading, then roll (x) and pitch (z) in the ship's own space.
  const yaw = Math.atan2(-hz, hx);
  const bob = Math.sin(t * 1.7) * 0.07;
  const roll = Math.sin(t * 1.3) * 0.035;
  if (t < VOYAGE_S) {
    const k = ease(t / VOYAGE_S);
    const back = (1 - k) * 13;
    return { position: [dx - hx * back, lerp(dy + 2.5, dy, k) + bob, dz - hz * back], rotation: [roll, yaw, -0.08 * (1 - k)], visible: true };
  }
  if (t < plan.battleEnd) return { position: [dx, dy + bob, dz], rotation: [roll, yaw, Math.sin(t * 0.9) * 0.02], visible: true };
  const k = Math.min(1, (t - plan.battleEnd) / RESULT_HOLD_S);
  const on = k * k * 16;
  return { position: [dx + hx * on, lerp(dy, dy + 4, k) + bob, dz + hz * on], rotation: [roll, yaw, 0.08 * k], visible: k < 1 };
}
