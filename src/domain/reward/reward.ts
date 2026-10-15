import { config, TIER_RANKS, type TierRank } from '../config';
import { CATALOG, speciesByRank, type AnimalSpecies } from '../animals/catalog';
import { clamp, lerp, type Rng } from '../random';

export function isEligible(effectiveMs: number): boolean {
  return effectiveMs >= config.reward.minFocusMs;
}

/** Tier probabilities by rank for an effective focus time. Always sums to 1. */
export function tierProbabilities(effectiveMs: number): number[] {
  const { minFocusMs, maxFocusMs, tierAtMin, tierAtMax } = config.reward;
  const t = clamp((effectiveMs - minFocusMs) / (maxFocusMs - minFocusMs), 0, 1);
  return TIER_RANKS.map((rank) => lerp(tierAtMin[rank] as number, tierAtMax[rank] as number, t));
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

export function pickSpecies(rank: TierRank, rng: Rng): AnimalSpecies {
  const pool = speciesByRank(rank);
  const species = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return species ?? (CATALOG[0] as AnimalSpecies);
}

/** Returns the earned species, or `undefined` when the focus was too short. */
export function rollReward(effectiveMs: number, rng: Rng): AnimalSpecies | undefined {
  if (!isEligible(effectiveMs)) return undefined;
  return pickSpecies(rollTier(effectiveMs, rng), rng);
}
