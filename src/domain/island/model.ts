import { DEFAULT_BLOCK_THEME, type TierRank } from '../config';
import { isActive } from '../animals/placed';
import { balance } from '../../../shared/balance/balance';
import { expiresAt } from '../../../shared/rules/expiry';
import type { Equipped, PlacedAnimal, PlacedBuilding, WorldState } from '../types';
import { skinForAnimal } from '../cosmetics/inventory';
import type { Tile } from './island';

export const DEFAULT_SKIN = 'default';

export interface IslandAnimal {
  id: string;
  speciesId: string;
  tierRank: TierRank;
  tile: Tile;
  skinId: string;
  /** Leaving now (Step 2.3): its order in the shown departure notice. */
  departure?: number;
  /** When it will leave (epoch ms), for the poke bubble (Step 2.6). Absent for exempt species or with the economy off. */
  expiresAt?: number;
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
  /** Active animals, plus departed ones whose departure notice has not been dismissed. */
  animals: IslandAnimal[];
  buildings: IslandBuilding[];
  /** 0..N visual bucket, not exact gold. */
  goldPileLevel: number;
  /** Shows the champion flag (F11). */
  championWeek?: string;
  /** Visits in the retention window: drives the visit-trace placeholder prop (Step 7.5). */
  visitCount?: number;
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
  /** The own island's visits (only with `features.visitTraceProp`). */
  visitCount?: number;
  /** Departed animals still drawn (`pendingDepartures().leaving`). */
  leaving?: ReadonlySet<string>;
  /** Animals whose departure plays now, in order. */
  departing?: readonly string[];
  /** Add `expiresAt` to each animal (own island with the economy on). */
  showExpiry?: boolean;
}

export function buildIslandModel(input: IslandModelInput): IslandModel {
  const equipped = input.equipped;
  const order = new Map((input.departing ?? []).map((id, i) => [id, i]));
  const model: IslandModel = {
    ownerId: input.ownerId ?? 'local',
    seed: input.world.seed,
    islandLevel: input.islandLevel,
    blockThemeId: input.equipped?.blockThemeId ?? input.world.blockThemeId ?? DEFAULT_BLOCK_THEME,
    animals: input.animals
      .filter((a) => isActive(a) || input.leaving?.has(a.id))
      .map((a) => {
        const expires = input.showExpiry ? expiresAt({ speciesId: a.speciesId, acquiredAt: a.acquiredAt }, balance.economy) : null;
        return {
          id: a.id,
          speciesId: a.speciesId,
          tierRank: a.tierRank,
          tile: { x: a.tileX, z: a.tileZ },
          skinId: equipped ? skinForAnimal(a, equipped) : DEFAULT_SKIN,
          ...(order.has(a.id) && { departure: order.get(a.id) }),
          ...(expires !== null && { expiresAt: expires }),
        };
      }),
    buildings: (input.buildings ?? []).map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })),
    goldPileLevel: input.goldPileLevel ?? 0,
  };
  if (input.championWeek) model.championWeek = input.championWeek;
  if (input.visitCount !== undefined) model.visitCount = input.visitCount;
  return model;
}
