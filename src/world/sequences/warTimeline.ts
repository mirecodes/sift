import type { WarView } from '../../../shared/api/types';

/**
 * The battle replay as a pure timeline (guidance_v2 Step 9.6): the airship's voyage, the landing, then
 * every round of the stored battle (approach, bump, fall), squeezed so the battle lasts at most
 * `BATTLE_MAX_S`. Poses are functions of time only, so Skip and 2× need no state.
 */
export const VOYAGE_S = 3.5;
export const LAND_S = 1.2;
export const BATTLE_MAX_S = 26;
export const RESULT_HOLD_S = 1;
const ROUND_MIN_S = 0.45;
const ROUND_MAX_S = 1.0;
/** Shares of a round: run to the meeting point, bump, the loser tips over and fades. */
const APPROACH = 0.55;
const BUMP = 0.15;

export interface FighterPlan {
  id: string;
  side: 'attacker' | 'defender';
  speciesId: string;
  skinId?: string;
  start: [number, number];
  /** One leg per round the fighter took part in. */
  legs: { round: number; from: [number, number]; to: [number, number]; lost: boolean }[];
  /** Round in which it fell, or null. */
  fellIn: number | null;
  vanished: boolean;
}

export interface WarPlan {
  fighters: FighterPlan[];
  roundS: number;
  battleStart: number;
  battleEnd: number;
  total: number;
}

export function planWar(war: Pick<WarView, 'attackers' | 'defenders' | 'rounds' | 'vanished'>): WarPlan {
  const rounds = war.rounds.length;
  const roundS = rounds ? Math.min(ROUND_MAX_S, Math.max(ROUND_MIN_S, BATTLE_MAX_S / rounds)) : 0;
  const vanished = new Set(war.vanished);
  const pos = new Map<string, [number, number]>();
  const fighters = new Map<string, FighterPlan>();
  for (const [side, list] of [['attacker', war.attackers], ['defender', war.defenders]] as const) {
    for (const f of list) {
      pos.set(f.id, [f.x, f.z]);
      fighters.set(f.id, { id: f.id, side, speciesId: f.speciesId, ...(f.skinId && { skinId: f.skinId }), start: [f.x, f.z], legs: [], fellIn: null, vanished: vanished.has(f.id) });
    }
  }
  war.rounds.forEach((round, r) => {
    for (const duel of round.duels) {
      for (const id of [duel.a, duel.d]) {
        const fp = fighters.get(id);
        if (!fp) continue;
        const from = pos.get(id)!;
        const lost = duel.loser === id;
        // Both run toward the meeting point; the loser falls just short of it.
        const to: [number, number] = lost ? [from[0] + (duel.meet[0] - from[0]) * 0.7, from[1] + (duel.meet[1] - from[1]) * 0.7] : duel.meet;
        fp.legs.push({ round: r, from, to, lost });
        pos.set(id, to);
        if (lost) fp.fellIn = r;
      }
    }
  });
  const battleStart = VOYAGE_S + LAND_S;
  const battleEnd = battleStart + rounds * roundS;
  return { fighters: [...fighters.values()], roundS, battleStart, battleEnd, total: battleEnd + RESULT_HOLD_S };
}

export interface Pose {
  x: number;
  z: number;
  /** 0 hidden … 1 fully shown. */
  opacity: number;
  /** Tipping over, radians. */
  tilt: number;
  /** Hop / bump height in tiles. */
  lift: number;
  /** Horizontal squash at the bump (1 = none). */
  squash: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => 1 - (1 - k) ** 2;

/** Where a fighter is at time `t` (seconds from the start of the replay). */
export function poseAt(plan: WarPlan, f: FighterPlan, t: number): Pose {
  // Attackers are aboard during the voyage and hop down during the landing.
  if (f.side === 'attacker' && t < VOYAGE_S) return { x: f.start[0], z: f.start[1], opacity: 0, tilt: 0, lift: 0, squash: 1 };
  if (f.side === 'attacker' && t < plan.battleStart) {
    const k = (t - VOYAGE_S) / LAND_S;
    return { x: f.start[0], z: f.start[1], opacity: Math.min(1, k * 2), tilt: 0, lift: Math.sin(Math.min(1, k) * Math.PI) * 0.6, squash: 1 };
  }
  let x = f.start[0];
  let z = f.start[1];
  for (const leg of f.legs) {
    const t0 = plan.battleStart + leg.round * plan.roundS;
    if (t < t0) break;
    const k = (t - t0) / plan.roundS;
    if (k < APPROACH) {
      const e = ease(k / APPROACH);
      return { x: lerp(leg.from[0], leg.to[0], e), z: lerp(leg.from[1], leg.to[1], e), opacity: 1, tilt: 0, lift: Math.abs(Math.sin(k * 18)) * 0.08, squash: 1 };
    }
    if (k < APPROACH + BUMP) {
      const b = (k - APPROACH) / BUMP;
      return { x: leg.to[0], z: leg.to[1], opacity: 1, tilt: 0, lift: Math.sin(b * Math.PI) * 0.15, squash: 1 + Math.sin(b * Math.PI) * 0.25 };
    }
    if (leg.lost) {
      const fall = Math.min(1, (k - APPROACH - BUMP) / (1 - APPROACH - BUMP));
      return { x: leg.to[0], z: leg.to[1], opacity: 1 - fall, tilt: fall * (Math.PI / 2), lift: 0, squash: 1 };
    }
    x = leg.to[0];
    z = leg.to[1];
  }
  if (f.fellIn !== null && t >= plan.battleStart + (f.fellIn + 1) * plan.roundS) return { x, z, opacity: 0, tilt: Math.PI / 2, lift: 0, squash: 1 };
  return { x, z, opacity: 1, tilt: 0, lift: 0, squash: 1 };
}

/** The airship: arrives during the voyage, stays docked, then leaves after the result. */
export function shipAt(plan: WarPlan, t: number, dock: [number, number, number]): { position: [number, number, number]; visible: boolean } {
  const [dx, dy, dz] = dock;
  if (t < VOYAGE_S) {
    const k = ease(t / VOYAGE_S);
    return { position: [lerp(dx - 18, dx, k), lerp(dy + 6, dy, k), dz], visible: true };
  }
  if (t < plan.battleEnd) return { position: dock, visible: true };
  const k = Math.min(1, (t - plan.battleEnd) / RESULT_HOLD_S);
  return { position: [lerp(dx, dx + 14, k * k), lerp(dy, dy + 4, k), dz], visible: k < 1 };
}
