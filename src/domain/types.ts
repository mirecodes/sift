import type { Tier, TierRank } from './config';
import type { Notice } from './inbox/notice';

export type { Tier, TierRank };

export interface Settings {
  focusMinutes: number;
  breakMinutes: number;
  soundEnabled: boolean;
  theme: 'light' | 'dark';
  /** 0 = Sunday, 1 = Monday (stats week view). */
  weekStartsOn: 0 | 1;
  showFocusPresence: boolean;
  liveProgress: boolean;
}

export interface FocusSession {
  id: string;
  startedAt: number; // epoch ms
  plannedFocusMs: number;
  endedAt?: number;
  effectiveFocusMs?: number; // planned + overtime, capped
  status: 'running' | 'completed' | 'abandoned';
  rewardAnimalId?: string; // PlacedAnimal.id
  /** Focus-together room (Phase 7); `null` for solo sessions. */
  togetherRoomId: string | null;
}

/** active: on the island · departed: lifetime expired, left gold · vanished: lost in a war · spent: Unicorn used for an island move. */
export type AnimalStatus = 'active' | 'departed' | 'vanished' | 'spent';
export type EndReason = 'expired' | 'war' | 'island_move';

export interface PlacedAnimal {
  id: string;
  speciesId: string; // catalog id
  tier: Tier;
  tierRank: TierRank;
  tileX: number; // relative to island center
  tileZ: number;
  acquiredAt: number;
  sessionId: string;
  status: AnimalStatus;
  /** When `status` left 'active' (epoch ms). */
  endedAt: number | null;
  endReason: EndReason | null;
  /** Earned with a server-verified session; always true for local-only saves. */
  verified: boolean;
  /** Placed by hand (Phase 10); automatic placement never moves it. */
  pinned: boolean;
  /** Skin picked when it arrived, from the species' chosen skins (ADR-043). Absent on older rows. */
  skinId?: string;
}

export interface WorldState {
  seed: number; // island shape seed, generated once
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
 * Singleton (kv `equipped`). Per species, the chosen skins (one or more, `default` included when
 * chosen; a species not listed wears the default). New animals get one of them at random (ADR-043).
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

export interface InboxRow {
  id: string;
  createdAt: number;
  notice: Notice;
}

export interface ContentPackRow {
  contentVersion: string;
  checksum: string;
  json: string;
  atlas: string;
  fetchedAt: number;
}
