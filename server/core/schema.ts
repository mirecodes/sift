import type { IslandState, SyncedBuilding, SyncedNotice } from '../../shared/api/types';
import type { Equipped, FocusSession, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal } from '../../shared/types/rows';

/**
 * Server tables (guidance_v2 §4.2, ADR-047). Every table stores the whole row as `data jsonb` plus the
 * key and the columns queries filter on (`index`), so one generic adapter serves Postgres and memory and
 * the SQL migration is generated from this file (`npm run server:sql`). Only the server core writes them.
 * User-owned tables (`owned`) carry `userId` and `updatedSeq` for delta sync (Step 5.2).
 */

export type ColumnType = 'text' | 'bigint' | 'boolean';

export interface TableSpec {
  /** Primary key fields (composite keys are joined in order). */
  key: readonly string[];
  /** Fields copied into columns for equality filters. */
  index?: Readonly<Record<string, ColumnType>>;
  /** Unique constraints over index or key fields. */
  unique?: readonly (readonly string[])[];
  /** Owned by one user: adds `userId` and `updatedSeq` columns and the delta query. */
  owned?: boolean;
  /** Migration number that creates the table (`server/supabase/migrations`). */
  migration: number;
}

type Owned<T> = T & { userId: string; updatedSeq: number };

export interface ProfileRow {
  userId: string;
  /** Display name of the handle, e.g. `민지` (Phase 7). */
  handleName: string | null;
  /** Normalized name for uniqueness (NFC, Latin lower case). */
  handleKey: string | null;
  handleTag: string | null;
  nameChangedAt: number | null;
  avatarSpeciesId: string | null;
  showPresence: boolean;
  /** Last delta-sync sequence number handed out for this user. */
  seq: number;
  createdAt: number;
  /** When the user joined their current group (new-member protection, Phase 9). */
  joinedGroupAt?: number | null;
}

export interface DeviceRow {
  userId: string;
  deviceId: string;
  platform: string;
  pushToken: string | null;
  appVersion: string;
  locale: string;
  categories: Record<string, boolean>;
  lastSeen: number;
}

export interface ApiRequestRow {
  /** `userId:requestId` */
  key: string;
  userId: string;
  op: string;
  /** The stored result, returned again on a retry. */
  result: unknown;
  createdAt: number;
}

export interface AppConfigRow {
  key: string;
  value: unknown;
}

export interface RateRow {
  /** `userId:op:minute` */
  key: string;
  count: number;
  /** Minutes since the epoch. */
  minute: number;
}

export interface ContentReleaseRow {
  contentVersion: string;
  minClientVersion: string;
  packUrl: string;
  atlasUrl: string;
  checksum: string;
  publishedAt: number;
}

export interface Rows {
  profiles: ProfileRow;
  island_state: Owned<IslandState>;
  sessions: Owned<FocusSession>;
  animals: Owned<PlacedAnimal>;
  ledger: Owned<LedgerEntry>;
  cosmetics_owned: Owned<OwnedCosmetic>;
  equipped: Owned<Equipped>;
  placed_buildings: Owned<SyncedBuilding>;
  island_history: Owned<IslandHistoryEntry>;
  notices: Owned<SyncedNotice>;
  devices: DeviceRow;
  api_requests: ApiRequestRow;
  app_config: AppConfigRow;
  rate_counters: RateRow;
  content_releases: ContentReleaseRow;
}

export type TableName = keyof Rows;

export const TABLES: Readonly<Record<TableName, TableSpec>> = {
  profiles: { key: ['userId'], index: { handleKey: 'text', handleTag: 'text' }, unique: [['handleKey', 'handleTag']], migration: 1 },
  island_state: { key: ['userId'], owned: true, migration: 1 },
  sessions: { key: ['id'], index: { status: 'text' }, owned: true, migration: 1 },
  animals: { key: ['id'], index: { status: 'text' }, owned: true, migration: 1 },
  ledger: { key: ['id'], owned: true, migration: 1 },
  cosmetics_owned: { key: ['id'], owned: true, migration: 1 },
  equipped: { key: ['userId'], owned: true, migration: 1 },
  placed_buildings: { key: ['id'], owned: true, migration: 1 },
  island_history: { key: ['id'], owned: true, migration: 1 },
  notices: { key: ['id'], owned: true, migration: 1 },
  devices: { key: ['deviceId'], index: { userId: 'text' }, migration: 1 },
  api_requests: { key: ['key'], index: { userId: 'text', createdAt: 'bigint' }, migration: 1 },
  app_config: { key: ['key'], migration: 1 },
  rate_counters: { key: ['key'], index: { minute: 'bigint' }, migration: 1 },
  content_releases: { key: ['contentVersion'], migration: 1 },
};

/** Tables a user's data lives in (account export and deletion). */
export const OWNED_TABLES = (Object.keys(TABLES) as TableName[]).filter((t) => TABLES[t].owned);

/** Primary key value of a row (composite keys joined with `|`). */
export const keyOf = (table: TableName, row: object): string =>
  TABLES[table].key.map((k) => String((row as Record<string, unknown>)[k])).join('|');

/** Every column a query may filter on. */
export const filterable = (table: TableName): string[] => {
  const spec = TABLES[table];
  return [...spec.key, ...Object.keys(spec.index ?? {}), ...(spec.owned ? ['userId', 'updatedSeq'] : [])];
};
