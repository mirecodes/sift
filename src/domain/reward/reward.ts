import type { TierRank } from '../config';
import { CATALOG, type AnimalSpecies } from '../animals/catalog';
import type { Rng } from '../random';
import * as rule from '../../../shared/rules/reward';

/** The shared reward rule bound to the species catalog. */
export const { isEligible, tierProbabilities, rollTier } = rule;

export const pickSpecies = (rank: TierRank, rng: Rng): AnimalSpecies => rule.pickSpecies(CATALOG, rank, rng);

export const rollReward = (effectiveMs: number, rng: Rng): AnimalSpecies | undefined => rule.rollReward(effectiveMs, CATALOG, rng);
