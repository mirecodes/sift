import { isActive } from '../animals/placed';
import type { Rng } from '../random';
import type { StoredPhase } from '../timer/phase';
import type { IslandHistoryEntry, PlacedAnimal, PlacedBuilding, WorldState } from '../types';
import { islandLevel, placeAnimals } from './level';

export type MoveProblem = 'no_unicorn' | 'not_idle';

export interface MoveInput {
  phase: StoredPhase;
  world: WorldState;
  animals: readonly PlacedAnimal[];
  buildings: readonly PlacedBuilding[];
  history: readonly IslandHistoryEntry[];
  newSeed: number;
  now: number;
  rng: Rng;
  historyId: string;
}

export interface MoveOutcome {
  world: WorldState;
  /** The Unicorn that paid for the move (`spent`). */
  spent: PlacedAnimal;
  /** Every animal that changed: the spent Unicorn and every active animal on its new tile. */
  animals: PlacedAnimal[];
  /** Placed buildings, all returned to the inventory (§9 Q15). */
  buildingsRemoved: string[];
  /** The island left behind. */
  history: IslandHistoryEntry;
}

export const UNICORN = 'unicorn';

/** Active Unicorns, oldest first: the next one spent is the first. */
export const activeUnicorns = (animals: readonly PlacedAnimal[]): PlacedAnimal[] =>
  animals.filter((a) => isActive(a) && a.speciesId === UNICORN).sort((a, b) => a.acquiredAt - b.acquiredAt || a.id.localeCompare(b.id));

/**
 * Moves to a new island (guidance_v2 Step 4.1), all in one outcome the caller writes in one transaction:
 * the oldest active Unicorn is `spent`; the world takes `newSeed` with the same island level (ADR-032),
 * so the new island is as big as the old one; every other active animal gets a tile on the new terrain
 * (pins cleared, expiry clocks unchanged); every placed building goes back to the inventory; the old
 * seed joins the island history. Only on Home, and only with a Unicorn.
 */
export function moveIsland(input: MoveInput): MoveOutcome | MoveProblem {
  if (input.phase.kind !== 'idle') return 'not_idle';
  const unicorn = activeUnicorns(input.animals)[0];
  if (!unicorn) return 'no_unicorn';

  const spent: PlacedAnimal = { ...unicorn, status: 'spent', endedAt: input.now, endReason: 'island_move', pinned: false };
  const movers = input.animals.filter((a) => isActive(a) && a.id !== unicorn.id).sort((a, b) => a.acquiredAt - b.acquiredAt || a.id.localeCompare(b.id));
  const tiles = placeAnimals(input.newSeed, islandLevel(input.animals), movers.map((a) => a.id), input.rng);
  const moved = movers.map((a): PlacedAnimal => {
    const tile = tiles.get(a.id);
    return { ...a, pinned: false, ...(tile && { tileX: tile.x, tileZ: tile.z }) };
  });

  const from = Math.max(...input.history.map((h) => h.to), Math.min(input.now, ...input.animals.map((a) => a.acquiredAt)));
  return {
    world: { ...input.world, seed: input.newSeed },
    spent,
    animals: [spent, ...moved],
    buildingsRemoved: input.buildings.map((b) => b.id),
    history: { id: input.historyId, seed: input.world.seed, from, to: input.now },
  };
}
