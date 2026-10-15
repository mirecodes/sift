import { tierRank } from '../config';
import type { Tile } from '../island/island';
import type { PlacedAnimal } from '../types';
import type { AnimalSpecies } from './catalog';

/** A newly earned, active animal on `tile`. */
export function newPlacedAnimal(id: string, species: AnimalSpecies, tile: Tile, acquiredAt: number, sessionId: string): PlacedAnimal {
  return {
    id,
    speciesId: species.id,
    tier: species.tier,
    tierRank: tierRank(species.tier),
    tileX: tile.x,
    tileZ: tile.z,
    acquiredAt,
    sessionId,
    status: 'active',
    endedAt: null,
    endReason: null,
    verified: true,
    pinned: false,
  };
}
