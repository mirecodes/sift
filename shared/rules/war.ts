import { balance } from '../balance/balance';
import { seededRng } from '../rng';
import type { PlacedAnimal } from '../types/rows';

/**
 * War inside a group (guidance_v2 Steps 9.1–9.4): armies, formation, the deterministic battle and the
 * loot. Everything is decided on the server from a random seed; clients only replay `rounds`.
 */
/** The war settings the rules read (`balance.war`; tests pass variations). */
export interface WarConfig {
  lossOdds: { base: number; byGap: readonly number[] };
  vanishChanceOnFall: number;
  unicornAura: { radius: number; vanishChance: number };
  attackExcludedSpecies: readonly string[];
  lootBrackets: readonly { minGold: number; loot: number }[];
  lootLostCapPerWeek: number | null;
  maxRounds: number;
  landingWaves: number;
  matchFalloff: number;
}
type War = WarConfig;

export interface Fighter {
  id: string;
  speciesId: string;
  tierRank: number;
  skinId?: string;
  /** Tile position (defenders: their island tile; attackers: where they land on it). */
  x: number;
  z: number;
  /** Attackers: the battle step they land in (they fight from then on). Absent = step 0. */
  landAt?: number;
}

export interface Duel {
  a: string;
  d: string;
  /** Where they meet; the winner stays there. */
  meet: [number, number];
  loser: string;
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  rounds: { duels: Duel[] }[];
  fallen: string[];
  vanished: string[];
  /** Defenders inside a defending Unicorn's aura at the start (vanish at 5 %). */
  protected: string[];
}

/** Attackers: active verified animals, Unicorns stay home. Defenders: all active verified animals. */
export function attackArmy(animals: readonly PlacedAnimal[], cfg: War = balance.war): PlacedAnimal[] {
  return animals.filter((a) => a.status === 'active' && a.verified && !cfg.attackExcludedSpecies.includes(a.speciesId));
}
export function defenseArmy(animals: readonly PlacedAnimal[]): PlacedAnimal[] {
  return animals.filter((a) => a.status === 'active' && a.verified);
}

/** The order an army lines up and fights in: highest rank first, Tigers lead their rank, then by id. */
export const byRank = (a: Pick<Fighter, 'tierRank' | 'speciesId' | 'id'>, b: Pick<Fighter, 'tierRank' | 'speciesId' | 'id'>): number =>
  b.tierRank - a.tierRank || Number(b.speciesId === 'tiger') - Number(a.speciesId === 'tiger') || a.id.localeCompare(b.id);

/**
 * The landing (Step 9.2, owner change 2026-11-04): attackers hop off the ship onto the defender island
 * itself, in `landingWaves` waves one battle step apart, highest ranks first (Tigers lead). Each takes a
 * random tile of `tiles` (the island's standable tiles), all different while there are enough, so the
 * battle spreads over the whole island.
 */
export function landOnIsland(attackers: readonly Omit<Fighter, 'x' | 'z'>[], tiles: readonly { x: number; z: number }[], seed: number, cfg: War = balance.war): Fighter[] {
  const rng = seededRng(seed ^ 0x5eed);
  const pool = [...tiles].sort((a, b) => a.x - b.x || a.z - b.z);
  const order = [...attackers].sort(byRank);
  const perWave = Math.max(1, Math.ceil(order.length / Math.max(1, cfg.landingWaves)));
  let free: { x: number; z: number }[] = [];
  return order.map((a, i) => {
    if (!free.length) free = [...pool];
    const tile = free.length ? free.splice(Math.floor(rng() * free.length), 1)[0]! : { x: 0, z: 0 };
    return { ...a, x: tile.x, z: tile.z, landAt: Math.floor(i / perWave) };
  });
}

const chebyshev = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

/** Chance that the higher-ranked side of a duel falls (Step 9.1). Same rank: 1/2. */
export function higherFallChance(gap: number, cfg: War = balance.war): number {
  if (gap === 0) return 0.5;
  const odds = cfg.lossOdds.byGap[gap] ?? cfg.lossOdds.base ** gap;
  return 1 / (odds + 1);
}

/**
 * The battle (Step 9.3, matching changed by the owner 2026-11-04), deterministic for a seed: each step the
 * living attackers that have landed (seeded shuffle) each pick an unmatched living defender at random,
 * weighted toward nearby ones (`matchFalloff`); every duel makes exactly one animal fall; the winner
 * stands at the meeting point. Ends when a side is empty (or after `maxRounds`: the defense holds).
 * Then every fallen animal rolls to vanish: 25 %, or 5 % inside a defending Unicorn's aura.
 */
export function simulateBattle(attackers: readonly Fighter[], defenders: readonly Fighter[], seed: number, cfg: War = balance.war): BattleResult {
  const rng = seededRng(seed);
  const unicorns = defenders.filter((d) => d.speciesId === 'unicorn');
  const shielded = new Set(defenders.filter((d) => unicorns.some((u) => chebyshev(u, d) <= cfg.unicornAura.radius)).map((d) => d.id));
  const pos = new Map<string, { x: number; z: number }>([...attackers, ...defenders].map((f) => [f.id, { x: f.x, z: f.z }]));
  const rank = new Map([...attackers, ...defenders].map((f) => [f.id, f.tierRank]));
  const liveA = new Map(attackers.map((f) => [f.id, f]));
  const liveD = new Map(defenders.map((f) => [f.id, f]));
  const rounds: BattleResult['rounds'] = [];
  const fallen: string[] = [];

  while (liveA.size && liveD.size && rounds.length < cfg.maxRounds) {
    const step = rounds.length;
    const order = [...liveA.values()].filter((f) => (f.landAt ?? 0) <= step).map((f) => f.id).sort();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const taken = new Set<string>();
    const duels: Duel[] = [];
    for (const a of order) {
      const pa = pos.get(a)!;
      const open = [...liveD.keys()].sort().filter((d) => !taken.has(d));
      if (!open.length) break;
      const weights = open.map((d) => {
        const pd = pos.get(d)!;
        return 1 / (1 + Math.hypot(pa.x - pd.x, pa.z - pd.z)) ** cfg.matchFalloff;
      });
      let pick = rng() * weights.reduce((s, w) => s + w, 0);
      let best = open[open.length - 1]!;
      for (const [i, w] of weights.entries()) {
        if ((pick -= w) < 0) {
          best = open[i]!;
          break;
        }
      }
      taken.add(best);
      const pd = pos.get(best)!;
      const meet: [number, number] = [(pa.x + pd.x) / 2, (pa.z + pd.z) / 2];
      const ra = rank.get(a)!;
      const rd = rank.get(best)!;
      const higherFalls = rng() < higherFallChance(Math.abs(ra - rd), cfg);
      const aFalls = ra === rd ? higherFalls : ra > rd ? higherFalls : !higherFalls;
      duels.push({ a, d: best, meet, loser: aFalls ? a : best });
    }
    for (const duel of duels) {
      const winner = duel.loser === duel.a ? duel.d : duel.a;
      pos.set(winner, { x: duel.meet[0], z: duel.meet[1] });
      liveA.delete(duel.loser);
      liveD.delete(duel.loser);
      fallen.push(duel.loser);
    }
    rounds.push({ duels });
  }
  const vanished = fallen.filter((id) => rng() < (shielded.has(id) ? cfg.unicornAura.vanishChance : cfg.vanishChanceOnFall));
  return { winner: liveD.size === 0 ? 'attacker' : 'defender', rounds, fallen, vanished, protected: [...shielded].sort() };
}

/**
 * Gold the attacker takes on a win (Step 9.4): the bracket of the defender's balance, never more than
 * they have; with a weekly cap, never more than what the cap still allows.
 */
export function lootFor(defenderGold: number, lostThisWeek = 0, cfg: War = balance.war): number {
  const gold = Math.max(0, Math.floor(defenderGold));
  let loot = 0;
  for (const b of cfg.lootBrackets) if (gold >= b.minGold) loot = b.loot;
  loot = Math.min(gold, loot);
  if (cfg.lootLostCapPerWeek !== null) loot = Math.max(0, Math.min(loot, cfg.lootLostCapPerWeek - lostThisWeek));
  return loot;
}
