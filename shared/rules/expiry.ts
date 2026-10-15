import type { TierRank } from './tier';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExpiryAnimal {
  id: string;
  speciesId: string;
  tierRank: TierRank;
  /** When it was earned (epoch ms). */
  acquiredAt: number;
  status: string;
}

export interface ExpiryConfig {
  animalLifetimeDays: number;
  expiryExemptSpecies: readonly string[];
  /** Gold an animal leaves, by tier rank. */
  goldByTierRank: readonly number[];
}

export interface Expiration {
  animalId: string;
  /** The real expiry moment (`acquiredAt + lifetime`), not when it was applied. */
  expiredAt: number;
  gold: number;
}

/**
 * Active animals whose lifetime has run out at `now` (guidance_v2 Step 2.2). An animal expires
 * at exactly `acquiredAt + lifetime`. Exempt species never expire. Pure: applying the result
 * (status `departed`) makes a second run return nothing for those animals.
 */
export function computeExpirations(animals: readonly ExpiryAnimal[], now: number, cfg: ExpiryConfig): Expiration[] {
  const lifetime = cfg.animalLifetimeDays * DAY_MS;
  return animals
    .filter((a) => a.status === 'active' && !cfg.expiryExemptSpecies.includes(a.speciesId) && a.acquiredAt + lifetime <= now)
    .map((a) => ({ animalId: a.id, expiredAt: a.acquiredAt + lifetime, gold: cfg.goldByTierRank[a.tierRank] ?? 0 }));
}

/** When an active animal will expire, or `null` for exempt species. */
export function expiresAt(animal: Pick<ExpiryAnimal, 'speciesId' | 'acquiredAt'>, cfg: ExpiryConfig): number | null {
  return cfg.expiryExemptSpecies.includes(animal.speciesId) ? null : animal.acquiredAt + cfg.animalLifetimeDays * DAY_MS;
}
