import type { Equipped, FocusSession, InboxRow, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding, WorldState } from '../types/rows';

/**
 * The versioned API contract (guidance_v2 Step 5.2, docs/reference/API.md). Every client (web, iOS,
 * Android, several app versions at once) and the server use these types. Rules: add fields, never
 * repurpose them; a breaking change bumps `API_VERSION` and `app_config.min_supported_api_version`.
 */
export const API_VERSION = 1;

/** `x-sift-client: <platform>/<appVersion>/<apiVersion>`, e.g. `web/0.2.0/1`. */
export const CLIENT_HEADER = 'x-sift-client';

/** Stable error codes; the client maps them to strings and never shows raw server text. */
export type ErrorCode =
  | 'client_outdated'
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid'
  | 'not_found'
  | 'server_error'
  /** Transport: no answer (the client retries with the same request id). */
  | 'network'
  | 'insufficient_gold'
  | 'item_unavailable'
  | 'already_owned'
  | 'species_not_found'
  | 'session_already_running'
  | 'session_not_running'
  | 'no_unicorn'
  | 'not_idle'
  | 'layout_invalid'
  | 'account_not_empty'
  // Phase 7–9 (social):
  | 'handle_invalid'
  | 'handle_taken'
  | 'name_change_cooldown'
  | 'handle_required'
  | 'blocked'
  | 'friend_limit'
  | 'not_friends'
  | 'not_in_group'
  | 'already_in_group'
  | 'group_full'
  | 'rejoin_cooldown'
  | 'not_owner'
  | 'room_closed'
  | 'cooldown_active'
  | 'shield_active'
  | 'protected_new_member'
  | 'settlement_freeze'
  | 'war_disabled'
  | 'no_army';

/** The island itself: shape seed, block theme, champion flag (Phase 8). */
export interface IslandState extends WorldState {
  championWeek?: string;
}

export type SyncedBuilding = PlacedBuilding & { deleted?: true };
export type SyncedNotice = InboxRow & { dismissed?: true };

/** Everything the server holds for one user, as rows (delta sync, Step 5.6). */
export interface SyncRows {
  animals: PlacedAnimal[];
  ledger: LedgerEntry[];
  cosmetics: OwnedCosmetic[];
  placedBuildings: SyncedBuilding[];
  sessions: FocusSession[];
  islandHistory: IslandHistoryEntry[];
  notices: SyncedNotice[];
  equipped?: Equipped;
  island?: IslandState;
}

/** Rows changed after the client's `sinceSeq`, and the new cursor. */
export interface SyncDelta {
  seq: number;
  rows: SyncRows;
}

export interface ProfileView {
  userId: string;
  /** `name#tag` (Phase 7); null until chosen. */
  handle: { name: string; tag: string } | null;
  avatarSpeciesId: string | null;
  showPresence: boolean;
  nameChangedAt: number | null;
}

/** Another user as the social screens show them (Phase 7). */
export interface PersonView {
  userId: string;
  handle: { name: string; tag: string } | null;
  /** Their chosen avatar, else the species of their newest animal, else null (a default sprite). */
  avatarSpeciesId: string | null;
  /** Focusing now (presence): only if they share it and neither side blocked the other. */
  focusing: boolean;
}

/** Everything the Friends tab shows, in one call (Steps 7.3, 7.5, 7.6). */
export interface SocialState {
  me: ProfileView;
  friends: PersonView[];
  /** Requests to me, oldest first. */
  incoming: PersonView[];
  /** My requests, oldest first. */
  outgoing: PersonView[];
  blocked: PersonView[];
  /** Who visited my island lately (newest first, at most 20). */
  visitors: { person: PersonView; at: number }[];
  /** Visits to my island in the retention window (the trace prop placeholder, Step 7.5). */
  visitCount: number;
}

/** What a visitor needs to draw someone's island (`IslandModel`, Step 7.4). */
export interface IslandSnapshot {
  userId: string;
  handle: { name: string; tag: string } | null;
  world: WorldState;
  /** Island size level (monotonic, from every animal ever earned). */
  level: number;
  /** Active animals only. */
  animals: PlacedAnimal[];
  buildings: PlacedBuilding[];
  equipped: Equipped;
  goldPileLevel: number;
  championWeek: string | null;
  /** Weekly score, only between members of the same group (Phase 8). */
  score?: number;
}

export type ReportReason = 'name' | 'harassment' | 'cheating' | 'other';

/** A focus-together room (Step 7.7). */
export interface RoomView {
  id: string;
  hostId: string;
  plannedMs: number;
  status: 'lobby' | 'started' | 'closed';
  createdAt: number;
  startedAt: number | null;
  /** Host first, then by invitation. */
  participants: {
    person: PersonView;
    /** invited · joined (lobby) · focusing · stopped · done (completed) · left */
    state: 'invited' | 'joined' | 'focusing' | 'stopped' | 'done' | 'left';
    /** Their revealed animal once done (the Break strip). */
    animal: { speciesId: string; tierRank: number; skinId?: string } | null;
  }[];
}

/** Score parts for the ranking breakdown (Step 8.4); see `shared/rules/scoring.ts`. */
export interface ScoreView {
  score: number;
  activeByTier: number[];
  activePoints: number;
  lostInBattle: number;
  lostPoints: number;
}

export interface MemberView {
  person: PersonView;
  role: 'owner' | 'member';
  joinedAt: number;
  /** 1-based; ties share a rank. */
  rank: number;
  score: ScoreView;
  /** This week's focus time (information only). */
  weekFocusMinutes: number;
  /** Won the last settled week (crown). */
  champion: boolean;
}

export interface MissionView {
  kind: 'focusMinutes';
  weekStart: string;
  memberCount: number;
  targetMinutes: number;
  progressMinutes: number;
  milestones: { minutes: number; gold: number; reached: boolean }[];
  /** Most first. */
  contributions: { person: PersonView; minutes: number }[];
}

/** The Group tab (Steps 8.1–8.5). */
export interface GroupView {
  id: string;
  name: string;
  ownerId: string;
  timezone: string;
  warEnabled: boolean;
  /** Members see the code to share it; the owner can regenerate or disable it. */
  inviteCode: string;
  inviteCodeEnabled: boolean;
  /** The ranking week in progress and when it settles (server time). */
  week: { start: string; endsAt: number };
  members: MemberView[];
  mission: MissionView;
}

export interface GroupInviteView {
  id: string;
  groupId: string;
  groupName: string;
  memberCount: number;
  inviter: PersonView;
}

/** A device's local save, uploaded once at the first sign-in (Step 5.7). */
export interface LocalSave {
  world: WorldState;
  animals: PlacedAnimal[];
  sessions: FocusSession[];
  ledger: LedgerEntry[];
  cosmetics: OwnedCosmetic[];
  equipped?: Equipped;
  placedBuildings: PlacedBuilding[];
  islandHistory: IslandHistoryEntry[];
}

/** Newest content pack this client version can use (Step 5.8). */
export interface ContentManifest {
  contentVersion: string;
  minClientVersion?: string;
  packUrl: string;
  atlasUrl: string;
  /** SHA-256 (hex) of the pack JSON text. */
  checksum: string;
}

/** Non-economic changes sent through the outbox (Step 5.6). */
export type PushOp =
  | { kind: 'equip'; equipped: Equipped }
  | { kind: 'dismiss_notice'; id: string }
  /** A session that started offline (§9 Q16): stored unverified, its animal excluded from score and war. */
  | { kind: 'local_session'; session: FocusSession; animal: PlacedAnimal | null }
  | { kind: 'presence_setting'; showPresence: boolean };

export type Platform = 'web' | 'ios' | 'android';

/** Every operation: its arguments and result. Later phases add theirs. */
export interface Ops {
  me: { args: Record<string, never>; result: { profile: ProfileView; hasData: boolean } };
  /** `sessionId`: the client's own id for the session (a UUID), so a session started offline-first keeps one id. */
  start_session: { args: { sessionId?: string; plannedMs: number; roomId?: string | null; force?: boolean }; result: { session: FocusSession } };
  end_session: { args: { sessionId: string; endedAt: number; status: 'completed' | 'abandoned' }; result: { session: FocusSession; animal: PlacedAnimal | null } };
  sync_pull: { args: Record<string, never>; result: Record<string, never> };
  sync_push: { args: { ops: PushOp[] }; result: Record<string, never> };
  purchase: { args: { defId: string }; result: { item: OwnedCosmetic } };
  apply_layout: { args: { buildings: PlacedBuilding[]; animals?: { id: string; tileX: number; tileZ: number; pinned: boolean }[] }; result: Record<string, never> };
  move_island: { args: { seed: number }; result: Record<string, never> };
  get_content_manifest: { args: { clientVersion: string }; result: { manifest: ContentManifest | null } };
  upload_local_save: { args: { save: LocalSave; replace: boolean }; result: Record<string, never> };
  export_account: { args: Record<string, never>; result: { profile: ProfileView; rows: SyncRows } };
  delete_account: { args: Record<string, never>; result: Record<string, never> };
  register_device: { args: { deviceId: string; platform: Platform; pushToken: string | null; appVersion: string; locale: string; categories?: Record<string, boolean> }; result: Record<string, never> };
  // --- Phase 7: identity, friends, moderation, visits, presence, focus together ---
  social_state: { args: Record<string, never>; result: SocialState };
  /** Chooses or changes the name; the server assigns the tag (kept if free under the new name). */
  set_handle: { args: { name: string }; result: { profile: ProfileView } };
  /** Sends a request to an exact handle; a request already waiting the other way is accepted instead. */
  friend_request: { args: { name: string; tag: string }; result: { status: 'pending' | 'accepted'; person: PersonView } };
  friend_respond: { args: { userId: string; accept: boolean }; result: Record<string, never> };
  friend_cancel: { args: { userId: string }; result: Record<string, never> };
  friend_remove: { args: { userId: string }; result: Record<string, never> };
  block_user: { args: { userId: string }; result: Record<string, never> };
  unblock_user: { args: { userId: string }; result: Record<string, never> };
  report_user: { args: { userId: string; reason: ReportReason; note?: string; context: 'friends' | 'group' | 'visit' }; result: Record<string, never> };
  /** Friends or members of the same group, neither blocked; records the visit. */
  get_island_snapshot: { args: { userId: string }; result: { snapshot: IslandSnapshot } };
  together_create: { args: { plannedMs: number; invitees: string[] }; result: { room: RoomView } };
  together_room: { args: { roomId: string }; result: { room: RoomView } };
  together_join: { args: { roomId: string }; result: { room: RoomView } };
  together_leave: { args: { roomId: string }; result: { room: RoomView } };
  /** Host only: everyone who joined starts at the same server time. */
  together_start: { args: { roomId: string }; result: { room: RoomView } };
  // --- Phase 8: groups, ranking, missions, weekly settlement ---
  /** The user's group (settling a passed week first), pending invites, and when they may join again. */
  group_state: { args: Record<string, never>; result: { group: GroupView | null; invites: GroupInviteView[]; rejoinAt: number | null } };
  group_create: { args: { name: string; timezone: string }; result: { group: GroupView } };
  group_rename: { args: { name: string }; result: Record<string, never> };
  /** Any member invites a friend. */
  group_invite: { args: { userId: string }; result: Record<string, never> };
  group_invite_respond: { args: { inviteId: string; accept: boolean }; result: Record<string, never> };
  group_join: { args: { code: string }; result: { group: GroupView } };
  /** Owner: a new code, or turn the code off / on. */
  group_code: { args: { action: 'regenerate' | 'disable' | 'enable' }; result: { code: string; enabled: boolean } };
  group_leave: { args: Record<string, never>; result: Record<string, never> };
  group_remove_member: { args: { userId: string }; result: Record<string, never> };
  group_transfer: { args: { userId: string }; result: Record<string, never> };
  group_set_war: { args: { enabled: boolean }; result: Record<string, never> };
  group_disband: { args: Record<string, never>; result: Record<string, never> };
}

export type Op = keyof Ops;
export type OpArgs<O extends Op> = Ops[O]['args'];
export type OpResult<O extends Op> = Ops[O]['result'];

/** Operations that change data: they need a `requestId` and are answered once (idempotency, 48 h). */
export const MUTATIONS: ReadonlySet<Op> = new Set<Op>([
  'start_session',
  'end_session',
  'sync_push',
  'purchase',
  'apply_layout',
  'move_island',
  'upload_local_save',
  'delete_account',
  'register_device',
  'set_handle',
  'friend_request',
  'friend_respond',
  'friend_cancel',
  'friend_remove',
  'block_user',
  'unblock_user',
  'report_user',
  'together_create',
  'together_join',
  'together_leave',
  'together_start',
  'group_create',
  'group_rename',
  'group_invite',
  'group_invite_respond',
  'group_join',
  'group_code',
  'group_leave',
  'group_remove_member',
  'group_transfer',
  'group_set_war',
  'group_disband',
]);

/** Operations open to signed-out clients. */
export const PUBLIC_OPS: ReadonlySet<Op> = new Set<Op>(['get_content_manifest']);

export interface ApiRequest<O extends Op = Op> {
  op: O;
  args: OpArgs<O>;
  /** Client-generated UUID, reused on every retry of the same call. Required for `MUTATIONS`. */
  requestId?: string;
  /** The client's sync cursor: the response carries every row changed after it. */
  sinceSeq?: number;
}

export type ApiResponse<O extends Op = Op> =
  | { ok: true; data: OpResult<O>; delta?: SyncDelta; serverNow: number }
  | { ok: false; error: { code: ErrorCode; retryAfterMs?: number }; serverNow: number };

/** `web/0.2.0/1` → parts; null when malformed. */
export function parseClientHeader(value: string | null | undefined): { platform: Platform; appVersion: string; apiVersion: number } | null {
  const m = value?.match(/^(web|ios|android)\/(\d+\.\d+\.\d+)\/(\d+)$/);
  return m ? { platform: m[1] as Platform, appVersion: m[2]!, apiVersion: Number(m[3]) } : null;
}

export const clientHeader = (platform: Platform, appVersion: string): string => `${platform}/${appVersion}/${API_VERSION}`;
