import { tierName, type Tier, type TierRank } from '../config';
import { content } from '../content';

export interface AnimalSpecies {
  id: string;
  /** English display name. */
  name: string;
  names: { en: string; ko: string };
  tierRank: TierRank;
  /** Stored label for `tierRank`; never compared in logic. */
  tier: Tier;
  /** The pack's model ref (`animals/<id>`, file `content/animals/<id>/model.ts`). */
  modelId: string;
  /** Idle animation set preset (Step 3.2). */
  idleAnimation: 'default' | 'flop' | 'sparkle' | 'rainbow' | 'flutter';
  /** Tiles occupied, [x, z]. All species are 1×1 (ADR-005). */
  footprint: readonly [number, number];
}

/** The species from `content/animals/<id>/animal.json`, by tier, then by id (Step 3.1). */
export const CATALOG: readonly AnimalSpecies[] = content.all('species').map((s) => ({
  id: s.id,
  name: s.name.en,
  names: s.name,
  tierRank: s.tierRank,
  tier: tierName(s.tierRank),
  modelId: s.model,
  idleAnimation: s.idle as AnimalSpecies['idleAnimation'],
  footprint: [1, 1],
}));

const BY_ID = new Map(CATALOG.map((a) => [a.id, a]));

export function getSpecies(id: string): AnimalSpecies {
  const species = BY_ID.get(id);
  if (!species) throw new Error(`Unknown animal species: ${id}`);
  return species;
}

export const speciesByRank = (rank: TierRank): AnimalSpecies[] => CATALOG.filter((a) => a.tierRank === rank);
