import { DEFAULT_BLOCK_THEME, type TierRank } from '../config';
import { isActive } from '../animals/placed';
import type { Equipped, PlacedAnimal, PlacedBuilding, WorldState } from '../types';
import type { Tile } from './island';

export const DEFAULT_SKIN = 'default';

export interface IslandAnimal {
  id: string;
  speciesId: string;
  tierRank: TierRank;
  tile: Tile;
  skinId: string;
}

export interface IslandBuilding {
  id: string;
  defId: string;
  tile: Tile;
  rotation: 0 | 90 | 180 | 270;
}

/** Everything the 3D world needs to draw one island (ADR-034). Plain data: own, a friend's, a defender's. */
export interface IslandModel {
  ownerId: string | 'local';
  seed: number;
  islandLevel: number;
  blockThemeId: string;
  /** Active animals only. */
  animals: IslandAnimal[];
  buildings: IslandBuilding[];
  /** 0..N visual bucket, not exact gold. */
  goldPileLevel: number;
  /** Shows the champion flag (F11). */
  championWeek?: string;
}

/** How an island is being viewed; the render mode (home/focus/break) is separate. */
export type IslandMode = 'own' | 'visit' | 'battle' | 'move';

export interface IslandModelInput {
  ownerId?: string | 'local';
  world: WorldState;
  islandLevel: number;
  animals: readonly PlacedAnimal[];
  equipped?: Equipped;
  buildings?: readonly PlacedBuilding[];
  goldPileLevel?: number;
  championWeek?: string;
}

export function buildIslandModel(input: IslandModelInput): IslandModel {
  const skins = input.equipped?.skinBySpecies ?? {};
  const model: IslandModel = {
    ownerId: input.ownerId ?? 'local',
    seed: input.world.seed,
    islandLevel: input.islandLevel,
    blockThemeId: input.equipped?.blockThemeId ?? input.world.blockThemeId ?? DEFAULT_BLOCK_THEME,
    animals: input.animals.filter(isActive).map((a) => ({
      id: a.id,
      speciesId: a.speciesId,
      tierRank: a.tierRank,
      tile: { x: a.tileX, z: a.tileZ },
      skinId: skins[a.speciesId] ?? DEFAULT_SKIN,
    })),
    buildings: (input.buildings ?? []).map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })),
    goldPileLevel: input.goldPileLevel ?? 0,
  };
  if (input.championWeek) model.championWeek = input.championWeek;
  return model;
}
