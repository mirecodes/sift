import type { Tier, TierRank } from '../rules/tier';

/**
 * Rows the client stores and the server owns once signed in (guidance_v2 §4.1, §4.2). One definition for
 * the local store, the API (`shared/api/types.ts`) and the server. Times are UTC epoch ms; ids are UUIDs.
 */

export interface FocusSession {
  id: string;
  startedAt: number;
  plannedFocusMs: number;
  endedAt?: number;
  /** Planned + overtime, capped. */
  effectiveFocusMs?: number;
  status: 'running' | 'completed' | 'abandoned';
  /** PlacedAnimal.id of the reward. */
  rewardAnimalId?: string;
  /** Focus-together room (Phase 7); `null` for solo sessions. */
  togetherRoomId: string | null;
  /** Started and ended on the server (signed in, online at start). Absent = local only. */
  verified?: boolean;
}

/** active: on the island · departed: lifetime expired, left gold · vanished: lost in a war · spent: Unicorn used for an island move. */
export type AnimalStatus = 'active' | 'departed' | 'vanished' | 'spent';
export type EndReason = 'expired' | 'war' | 'island_move';

export interface PlacedAnimal {
  id: string;
  speciesId: string;
  tier: Tier;
  tierRank: TierRank;
  /** Relative to the island center. */
  tileX: number;
  tileZ: number;
  acquiredAt: number;
  sessionId: string;
  status: AnimalStatus;
  /** When `status` left 'active'. */
  endedAt: number | null;
  endReason: EndReason | null;
  /** Earned with a server-verified session; always true for local-only saves (§2.3, §9 Q16). */
  verified: boolean;
  /** Placed by hand (Phase 10); automatic placement never moves it. */
  pinned: boolean;
  /** Skin picked when it arrived, from the species' chosen skins (ADR-043). Absent on older rows. */
  skinId?: string;
}

export interface WorldState {
  /** Island shape seed. */
  seed: number;
  blockThemeId: string;
}

export interface LedgerEntry {
  id: string;
  at: number;
  currency: 'gold';
  /** Positive = credit, negative = debit. */
  amount: number;
  reason: string;
  refId: string | null;
}

export type CosmeticKind = 'animalSkin' | 'blockTheme' | 'building';

export interface OwnedCosmetic {
  id: string;
  kind: CosmeticKind;
  defId: string;
  acquiredAt: number;
  source: string;
}

/**
 * Singleton. Per species, the chosen skins (one or more, `default` included when chosen; a species not
 * listed wears the default). New animals get one of them at random (ADR-043).
 */
export interface Equipped {
  skinsBySpecies: Record<string, string[]>;
  blockThemeId: string;
}

export interface PlacedBuilding {
  id: string;
  defId: string;
  tileX: number;
  tileZ: number;
  rotation: 0 | 90 | 180 | 270;
  placedAt: number;
}

/** A seed the island used before an island move (F5). */
export interface IslandHistoryEntry {
  id: string;
  seed: number;
  from: number;
  to: number;
}

/** Things to tell the user later, never during Focus (guidance_v2 §2.9). */
export type Notice =
  | { kind: 'animals_departed'; animalIds: string[]; gold: number }
  | { kind: 'weekly_result'; groupId: string; weekStart: string; winnerIds: string[]; youWon: boolean; gold: number }
  | { kind: 'war_report'; warId: string; role: 'attacker' | 'defender'; result: 'win' | 'loss'; opponentId?: string; vanished?: number; gold?: number; at?: number }
  | { kind: 'joined_group' | 'removed_from_group'; groupId: string; userId?: string }
  | { kind: 'friend_request' | 'friend_accepted'; userId: string }
  | { kind: 'group_invite'; groupId: string; inviterId: string }
  | { kind: 'mission_milestone'; groupId: string; weekStart: string; milestone: number; gold: number }
  | { kind: 'together_invite'; roomId: string; hostId: string }
  | { kind: 'war_loot'; warId: string; gold: number /* + gained, - lost */ };

export interface InboxRow {
  id: string;
  createdAt: number;
  notice: Notice;
}
