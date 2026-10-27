import type { Equipped, FocusSession, InboxRow, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding, Settings, WorldState } from '../../domain/types';
import type { PushOp } from '../../../shared/api/types';
import type { AwaitingReward, StoredPhase } from '../../domain/timer/phase';
import type { BackupData } from '../../domain/backup';

export interface PersistedState {
  settings?: Settings;
  world?: WorldState;
  /** `undefined` means idle. */
  phase?: StoredPhase;
  animals: PlacedAnimal[];
  sessions: FocusSession[];
  /** Queued notices, oldest first. */
  inbox: InboxRow[];
  /** Gold ledger, oldest first. */
  ledger: LedgerEntry[];
  /** Owned items, one row per instance, oldest first. */
  cosmetics: OwnedCosmetic[];
  equipped?: Equipped;
  placedBuildings: PlacedBuilding[];
  /** Islands left by island moves, oldest first. */
  islandHistory: IslandHistoryEntry[];
  /** The signed-in account this save mirrors (Phase 5); absent for a local-only save. */
  account?: AccountLink;
}

/** Sign-in state kept with the save (kv `account`): who, the sync cursor and unsent changes (Step 5.6). */
export interface AccountLink {
  userId: string;
  email: string | null;
  /** Delta-sync cursor: rows up to this sequence number are in the local store. */
  seq: number;
  /** Non-economic changes not yet acknowledged by the server, oldest first, each with a stable request id. */
  outbox: { requestId: string; op: PushOp }[];
  /** Verified sessions ended while offline: `end_session` is retried with the same request id (Step 5.5). */
  pendingEnds: AwaitingReward[];
}

/** Everything that must change together. An implementation applies it in one transaction. */
export interface Commit {
  session?: FocusSession;
  animal?: PlacedAnimal;
  /** Several animals at once (e.g. save repair). */
  animals?: PlacedAnimal[];
  /** The new active phase; `idle` clears the stored one. */
  phase?: StoredPhase;
  inboxAdd?: InboxRow[];
  /** Ids of notices that were shown and dismissed. */
  inboxRemove?: string[];
  /** Append-only: an entry whose id already exists fails the whole commit. */
  ledgerAdd?: LedgerEntry[];
  /** Items granted together with a purchase. */
  cosmeticsAdd?: OwnedCosmetic[];
  /** Equipped skins and block theme (kv singleton). */
  equipped?: Equipped;
  /** Placed or moved buildings, and buildings returned to the inventory. */
  buildingsPut?: PlacedBuilding[];
  buildingsRemove?: string[];
  /** A new island seed (island move). */
  world?: WorldState;
  islandHistoryAdd?: IslandHistoryEntry[];
  /** Several sessions at once (sync). */
  sessions?: FocusSession[];
  /** Ledger rows from the server: stored as they are, an existing id is left alone (replays). */
  ledgerSync?: LedgerEntry[];
  /** Sign-in link; `null` removes it. */
  account?: AccountLink | null;
}

export interface StorageAdapter {
  /** Schema version of the stored rows (backups record it). */
  readonly schemaVersion: number;
  load(): Promise<PersistedState>;
  /** Every row of every store. */
  exportAll(): Promise<BackupData>;
  /** Replaces every store with `data` (rows written with `schemaVersion`), in one transaction. */
  importAll(data: BackupData, schemaVersion: number): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  saveWorld(world: WorldState): Promise<void>;
  /** Replaces the world and deletes every placed animal, in one transaction. */
  resetWorld(world: WorldState): Promise<void>;
  commit(change: Commit): Promise<void>;
}
