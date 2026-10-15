import type { FocusSession, PlacedAnimal, Settings, WorldState } from '../../domain/types';
import type { StoredPhase } from '../../domain/timer/phase';
import type { BackupData } from '../../domain/backup';

export interface PersistedState {
  settings?: Settings;
  world?: WorldState;
  /** `undefined` means idle. */
  phase?: StoredPhase;
  animals: PlacedAnimal[];
  sessions: FocusSession[];
}

/** Everything that must change together. An implementation applies it in one transaction. */
export interface Commit {
  session?: FocusSession;
  animal?: PlacedAnimal;
  /** The new active phase; `idle` clears the stored one. */
  phase?: StoredPhase;
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
