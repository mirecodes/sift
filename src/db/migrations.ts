import { config, DEFAULT_BLOCK_THEME, TIERS, tierRank, type Tier } from '../domain/config';
import type { BackupData } from '../domain/backup';

/** Current storage schema. Every adapter (Dexie, memory, later SQLite) stores rows in this shape. */
export const SCHEMA_VERSION = 4;

/** Oldest schema a backup may come from (backups were introduced at schema 3). */
export const MIN_BACKUP_SCHEMA = 3;

type Row = Record<string, unknown>;

/**
 * Schema 4 (guidance_v2 §4.1), as pure row functions so every storage adapter and the
 * backup import run the same upgrade. Only adds fields; existing values never change.
 */
export const v4 = {
  animal: (a: Row): Row => ({
    tierRank: TIERS.includes(a.tier as Tier) ? tierRank(a.tier as Tier) : 0,
    status: 'active',
    endedAt: null,
    endReason: null,
    verified: true,
    pinned: false,
    ...a,
  }),
  session: (s: Row): Row => ({ togetherRoomId: null, ...s }),
  kv: (row: Row): Row => {
    const value = row.value as Row | undefined;
    if (row.key === 'world' && value) return { ...row, value: { blockThemeId: DEFAULT_BLOCK_THEME, ...value } };
    if (row.key === 'settings' && value) {
      const { weekStartsOn, showFocusPresence, liveProgress } = config.settings;
      return { ...row, value: { weekStartsOn, showFocusPresence, liveProgress, ...value } };
    }
    return row;
  },
};

/** Upgrades backup rows written with `fromVersion` to `SCHEMA_VERSION`. */
export function migrateRows(data: BackupData, fromVersion: number): BackupData {
  if (fromVersion < MIN_BACKUP_SCHEMA || fromVersion > SCHEMA_VERSION) throw new Error(`Unsupported backup schema ${fromVersion}`);
  if (fromVersion >= 4) return data;
  return {
    ...data,
    kv: (data.kv ?? []).map((r) => v4.kv(r as Row)),
    sessions: (data.sessions ?? []).map((r) => v4.session(r as Row)),
    animals: (data.animals ?? []).map((r) => v4.animal(r as Row)),
  };
}
