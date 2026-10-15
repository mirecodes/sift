import { balance } from '../balance/balance';
import { clamp, lerp, type Rng } from '../rng';
import { TIER_RANKS, type TierRank } from './tier';

/** Reward roll: tier by effective focus time, then a uniform species within the tier. */

export function isEligible(effectiveMs: number): boolean {
  return effectiveMs >= balance.reward.minFocusMs;
}

/** Tier probabilities by rank for an effective focus time. Always sums to 1. */
export function tierProbabilities(effectiveMs: number): number[] {
  const { minFocusMs, maxFocusMs, tierAtMin, tierAtMax } = balance.reward;
  const t = clamp((effectiveMs - minFocusMs) / (maxFocusMs - minFocusMs), 0, 1);
  return TIER_RANKS.map((rank) => lerp(tierAtMin[rank], tierAtMax[rank], t));
}

export function rollTier(effectiveMs: number, rng: Rng): TierRank {
  const p = tierProbabilities(effectiveMs);
  const r = rng();
  let acc = 0;
  for (const rank of TIER_RANKS) {
    acc += p[rank] as number;
    if (r < acc) return rank;
  }
  return 0; // floating-point remainder
}

/** Uniform pick among `catalog` entries of `rank`; the first entry if the tier is empty. */
export function pickSpecies<T extends { tierRank: TierRank }>(catalog: readonly T[], rank: TierRank, rng: Rng): T {
  const pool = catalog.filter((s) => s.tierRank === rank);
  const species = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return species ?? (catalog[0] as T);
}

/** Returns the earned species, or `undefined` when the focus was too short. */
export function rollReward<T extends { tierRank: TierRank }>(effectiveMs: number, catalog: readonly T[], rng: Rng): T | undefined {
  if (!isEligible(effectiveMs)) return undefined;
  return pickSpecies(catalog, rollTier(effectiveMs, rng), rng);
}
