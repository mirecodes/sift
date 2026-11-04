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
}
type War = WarConfig;

export interface Fighter {
  id: string;
  speciesId: string;
  tierRank: number;
  skinId?: string;
  /** Tile position (defenders: their island tile; attackers: the landing formation). */
  x: number;
  z: number;
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
 * The landing formation (Step 9.2): rows on a strip just off the defender island's front edge (+z),
 * `half` = the island's half width in tiles; the first row (highest ranks, Tigers first) is nearest.
 */
export function landingFormation(attackers: readonly Omit<Fighter, 'x' | 'z'>[], half: number): Fighter[] {
  const width = Math.max(3, 2 * half + 1);
  return [...attackers].sort(byRank).map((a, i) => {
    const row = Math.floor(i / width);
    const col = i % width;
    // Columns fill from the middle outwards: 0, +1, -1, +2, -2, …
    const offset = col === 0 ? 0 : col % 2 ? (col + 1) / 2 : -col / 2;
    return { ...a, x: offset, z: half + 1.5 + row * 0.8 };
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
 * The battle (Step 9.3), deterministic for a seed: each round living attackers (seeded shuffle) pick the
 * nearest unmatched living defender (ties by id); every duel makes exactly one animal fall; the winner
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
    const order = [...liveA.keys()].sort();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const taken = new Set<string>();
    const duels: Duel[] = [];
    for (const a of order) {
      const pa = pos.get(a)!;
      let best: string | null = null;
      let bestD = Infinity;
      for (const d of [...liveD.keys()].sort()) {
        if (taken.has(d)) continue;
        const pd = pos.get(d)!;
        const dist = Math.hypot(pa.x - pd.x, pa.z - pd.z);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      if (!best) break;
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
