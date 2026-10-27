import type { Tier, TierRank } from './config';
import type { PushCategory } from '../../shared/rules/push';

export type { Tier, TierRank };
/** Stored rows are shared with the server and the API (`shared/types/rows.ts`). */
export type {
  AnimalStatus,
  CosmeticKind,
  EndReason,
  Equipped,
  FocusSession,
  InboxRow,
  IslandHistoryEntry,
  LedgerEntry,
  OwnedCosmetic,
  PlacedAnimal,
  PlacedBuilding,
  WorldState,
} from '../../shared/types/rows';

export interface Settings {
  focusMinutes: number;
  breakMinutes: number;
  soundEnabled: boolean;
  theme: 'light' | 'dark';
  /** 0 = Sunday, 1 = Monday (stats week view). */
  weekStartsOn: 0 | 1;
  showFocusPresence: boolean;
  liveProgress: boolean;
  /** The one-line push explanation was answered (Step 6.6: asked once, at the first social action). */
  pushAsked: boolean;
  /** Push categories this device receives (Step 6.6). */
  pushCategories: Record<PushCategory, boolean>;
}

/** A downloaded content pack (Step 5.8). */
export interface ContentPackRow {
  contentVersion: string;
  checksum: string;
  json: string;
  atlas: string;
  fetchedAt: number;
}
