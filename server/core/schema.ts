import type { IslandState, SyncedBuilding, SyncedNotice, WarView } from '../../shared/api/types';
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

// --- Phase 7: friends, moderation, visits, focus together (migration 2) ---

/** One row per pair of users (`userLow < userHigh`), pending until the other side accepts. */
export interface FriendshipRow {
  /** `userLow|userHigh` */
  pair: string;
  userLow: string;
  userHigh: string;
  status: 'pending' | 'accepted';
  requestedBy: string;
  createdAt: number;
  acceptedAt: number | null;
}

export interface BlockRow {
  /** `blocker|blocked` */
  pair: string;
  blocker: string;
  blocked: string;
  createdAt: number;
}

export interface ReportRow {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  note: string;
  /** Where the report was made: friends list, group members, visit banner. */
  context: string;
  createdAt: number;
}

/** At most one per visitor per host per UTC day (Step 7.5). */
export interface VisitRow {
  /** `hostId|visitorId|day` */
  key: string;
  hostId: string;
  visitorId: string;
  at: number;
  /** Data-driven; today only `basic` with an empty payload. */
  traceKind: string;
  tracePayload: Record<string, unknown>;
}

export interface TogetherRoomRow {
  id: string;
  hostId: string;
  plannedMs: number;
  status: 'lobby' | 'started' | 'closed';
  createdAt: number;
  startedAt: number | null;
}

export interface TogetherParticipantRow {
  /** `roomId|userId` */
  key: string;
  roomId: string;
  userId: string;
  state: 'invited' | 'joined' | 'left';
  invitedAt: number;
  joinedAt: number | null;
}

// --- Phase 8: groups, ranking, missions, weekly settlement (migration 3) ---

export interface GroupRow {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  inviteCodeEnabled: boolean;
  /** IANA zone of the ranking week (Monday 00:00 local). */
  timezone: string;
  warEnabled: boolean;
  createdAt: number;
  /** Start date of the week in progress; older weeks are settled (Step 8.6). */
  week: string;
  /** Winners of the last settled week (the crown in the ranking). */
  championIds: string[];
  championWeek: string | null;
}

/** One group per user: keyed by the user. */
export interface GroupMemberRow {
  userId: string;
  groupId: string;
  role: 'owner' | 'member';
  joinedAt: number;
}

export interface GroupInviteRow {
  id: string;
  groupId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

/** Joins and leaves, for eligibility and the rejoin cooldown. */
export interface MembershipLogRow {
  id: string;
  groupId: string;
  userId: string;
  kind: 'join' | 'leave' | 'removed' | 'disband';
  at: number;
}

export interface WeeklyResultRow {
  /** `groupId|weekStart|userId` (unique: settlement is idempotent). */
  key: string;
  groupId: string;
  weekStart: string;
  userId: string;
  score: number;
  focusMinutes: number;
  rank: number;
  eligible: boolean;
  rewarded: boolean;
  balanceVersion: string;
}

export interface MissionWeekRow {
  /** `groupId|weekStart` */
  key: string;
  groupId: string;
  weekStart: string;
  kind: 'focusMinutes';
  memberCount: number;
  targetMinutes: number;
  progressMinutes: number;
  /** Indices of milestones already paid (each exactly once). */
  milestonesReached: number[];
  balanceVersion: string;
}

export interface MissionContributionRow {
  /** `groupId|weekStart|userId` */
  key: string;
  groupId: string;
  weekStart: string;
  userId: string;
  minutes: number;
}

// --- Phase 9: war (migration 4) ---

/** A decided battle (Step 9.5): the record is the replay. */
export interface WarRow extends Omit<WarView, 'attacker' | 'defender'> {
  attackerId: string;
  defenderId: string;
}

export interface Rows {
  profiles: ProfileRow;
  wars: WarRow;
  groups: GroupRow;
  group_members: GroupMemberRow;
  group_invites: GroupInviteRow;
  group_membership_log: MembershipLogRow;
  weekly_results: WeeklyResultRow;
  group_mission_weeks: MissionWeekRow;
  group_mission_contributions: MissionContributionRow;
  friendships: FriendshipRow;
  blocks: BlockRow;
  reports: ReportRow;
  visits: VisitRow;
  together_rooms: TogetherRoomRow;
  together_participants: TogetherParticipantRow;
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
  friendships: { key: ['pair'], index: { userLow: 'text', userHigh: 'text' }, migration: 2 },
  blocks: { key: ['pair'], index: { blocker: 'text', blocked: 'text' }, migration: 2 },
  reports: { key: ['id'], index: { reportedId: 'text' }, migration: 2 },
  visits: { key: ['key'], index: { hostId: 'text', visitorId: 'text', at: 'bigint' }, migration: 2 },
  together_rooms: { key: ['id'], index: { hostId: 'text', status: 'text' }, migration: 2 },
  together_participants: { key: ['key'], index: { roomId: 'text', userId: 'text' }, migration: 2 },
  groups: { key: ['id'], index: { inviteCode: 'text' }, unique: [['inviteCode']], migration: 3 },
  group_members: { key: ['userId'], index: { groupId: 'text' }, migration: 3 },
  group_invites: { key: ['id'], index: { groupId: 'text', inviteeId: 'text' }, migration: 3 },
  group_membership_log: { key: ['id'], index: { groupId: 'text', userId: 'text' }, migration: 3 },
  weekly_results: { key: ['key'], index: { groupId: 'text', weekStart: 'text', userId: 'text' }, migration: 3 },
  group_mission_weeks: { key: ['key'], index: { groupId: 'text' }, migration: 3 },
  group_mission_contributions: { key: ['key'], index: { groupId: 'text', weekStart: 'text' }, migration: 3 },
  wars: { key: ['id'], index: { groupId: 'text', attackerId: 'text', defenderId: 'text', createdAt: 'bigint' }, migration: 4 },
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
