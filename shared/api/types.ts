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
