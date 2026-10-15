/** Versioned JSON backup of every local store (Settings → Data). */

export const BACKUP_FORMAT = 'sift-backup';
export const BACKUP_VERSION = 1;

/** Rows per store, keyed by store name. */
export type BackupData = Record<string, unknown[]>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string; // UTC ISO
  /** Storage schema the rows were written with; older rows are upgraded on import. */
  schemaVersion: number;
  data: BackupData;
}

export type BackupError = 'invalid' | 'newer';
export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: BackupError };

/** Stores every backup has, with their string primary key. */
const REQUIRED_STORES: Record<string, string> = { kv: 'key', sessions: 'id', animals: 'id' };

export function createBackup(data: BackupData, schemaVersion: number, now: number): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), schemaVersion, data };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates format, version, and shape. `maxSchemaVersion` is the schema this app can read. */
export function parseBackup(text: string, maxSchemaVersion: number): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: 'invalid' };
  const { version, schemaVersion, exportedAt, data } = raw;
  if (!Number.isInteger(version) || !Number.isInteger(schemaVersion) || typeof exportedAt !== 'string' || !isObject(data)) {
    return { ok: false, error: 'invalid' };
  }
  if ((version as number) > BACKUP_VERSION || (schemaVersion as number) > maxSchemaVersion) return { ok: false, error: 'newer' };
  for (const rows of Object.values(data)) {
    if (!Array.isArray(rows) || !rows.every(isObject)) return { ok: false, error: 'invalid' };
  }
  for (const [store, key] of Object.entries(REQUIRED_STORES)) {
    const rows = data[store] as Record<string, unknown>[] | undefined;
    if (!rows || !rows.every((r) => typeof r[key] === 'string')) return { ok: false, error: 'invalid' };
  }
  return { ok: true, backup: raw as unknown as Backup };
}

export function summarizeBackup(backup: Backup): { exportedAt: number; sessions: number; animals: number } {
  return {
    exportedAt: Date.parse(backup.exportedAt),
    sessions: backup.data.sessions?.length ?? 0,
    animals: backup.data.animals?.length ?? 0,
  };
}

/** `sift-backup-2026-10-07.json` */
export const backupFileName = (backup: Backup): string => `${BACKUP_FORMAT}-${backup.exportedAt.slice(0, 10)}.json`;
