# API.md

The server contract (guidance_v2 Step 5.2). Types: `shared/api/types.ts`; handlers: `server/core/`; setup: `docs/guides/BACKEND_SETUP.md`.

## 1. Transport

- One endpoint: `POST {SUPABASE_URL}/functions/v1/api`, JSON body `{ op, args, requestId?, sinceSeq? }`.
- Headers: `apikey: <anon key>`, `authorization: Bearer <access token>` (the anon key when signed out), `x-sift-client: <platform>/<appVersion>/<apiVersion>` (e.g. `ios/0.2.0/1`).
- Answer (always HTTP 200 for API outcomes): `{ ok: true, data, delta?, serverNow }` or `{ ok: false, error: { code, retryAfterMs? }, serverNow }`.
- Auth is Supabase Auth over its REST API (no SDK, no cookies): `POST /auth/v1/otp` (email code), `POST /auth/v1/verify` (`type: email`), `POST /auth/v1/token?grant_type=id_token` (native Apple/Google), `GET /auth/v1/authorize?provider=…` (web OAuth, implicit flow), `POST /auth/v1/token?grant_type=refresh_token`, `POST /auth/v1/logout`.
- Jobs: `POST …/api/job/hourly` (and `/job/weekly` from Phase 8) with header `x-sift-job: <SIFT_JOB_SECRET>`; called by `pg_cron`.

## 2. Rules

| Rule | How |
|---|---|
| Versioning | `API_VERSION` = 1. Add fields, never repurpose them. A client below `app_config.client.minSupportedApiVersion` gets `client_outdated` and shows "Please update Sift". |
| Idempotency | Every mutation (`MUTATIONS`) needs a client UUID `requestId`, reused on every retry. The result is stored (`api_requests`, 48 h) and returned again; nothing is applied twice. |
| Typed errors | Stable `ErrorCode`s; the client maps them to its own strings. |
| Server time | Every answer has `serverNow` (epoch ms). Countdowns use the server offset. |
| Delta sync | User rows carry `updatedSeq` (one number per transaction). With `sinceSeq`, the answer carries `delta = { seq, rows }`: every row of the caller changed after it (deleted buildings come as `deleted: true`, dismissed notices as `dismissed: true`). |
| Transactions | One database transaction per call; the caller's expirations are settled first for calls that read or spend gold (`SETTLES`). |
| Rate limits | Per user and operation per minute (`app_config.client.rateLimits`, `default` 120); `rate_limited` with `retryAfterMs`. |
| Trust | Clients never write tables (RLS on, no policies); only this function does. Rewards, gold, purchases, layouts, moves and wars are computed on the server with the shared rules. |

## 3. Operations (Phase 5)

| Op | Args → data | Notes |
|---|---|---|
| `me` | `{}` → `{ profile, hasData }` | `hasData`: the account has an island (first sign-in, Step 5.7) |
| `start_session` | `{ sessionId?, plannedMs, roomId?, force? }` → `{ session }` | Server start time. One running session per user: `session_already_running` unless stale (plan + 2 h) or `force` |
| `end_session` | `{ sessionId, endedAt, status }` → `{ session, animal \| null }` | `endedAt` clamped into [start, now]; completed ≥ 25 min rolls tier and species and places the animal (verified) |
| `sync_pull` | `{}` → `{}` | Use with `sinceSeq` |
| `sync_push` | `{ ops: PushOp[] }` → `{}` | `equip` (sanitized against ownership), `dismiss_notice`, `presence_setting`, `local_session` (an offline-started session: stored unverified; its animal leaves no gold, counts for nothing in score or war) |
| `purchase` | `{ defId }` → `{ item }` | `insufficient_gold`, `already_owned`, `species_not_found`, `item_unavailable`; checked against the newest published catalog |
| `apply_layout` | `{ buildings, animals? }` → `{}` | The whole layout (Step 3.11 rules); displaced animals move; `animals` = pinned positions (Phase 10); `layout_invalid` |
| `move_island` | `{ seed }` → `{}` | Step 4.1 rule; `no_unicorn`, `not_idle` (a running session) |
| `get_content_manifest` | `{ clientVersion }` → `{ manifest \| null }` | Public. Newest release with `minClientVersion` ≤ the client |
| `upload_local_save` | `{ save, replace }` → `{}` | First sign-in. `account_not_empty` unless `replace`. Animals trusted once; gold carried over up to 1,000 (`IMPORTED_GOLD_CAP`) |
| `export_account` | `{}` → `{ profile, rows }` | Everything of the user |
| `delete_account` | `{}` → `{}` | Every row, then the auth user (in-app deletion) |
| `register_device` | `{ deviceId, platform, pushToken, appVersion, locale, categories? }` → `{}` | Push (Phase 6) |

### Phase 7: identity, friends, moderation, visits, presence, focus together

| Op | Args → data | Notes |
|---|---|---|
| `social_state` | `{}` → `SocialState` | `me`, `friends` (with `focusing`), `incoming`, `outgoing`, `blocked`, `visitors` (newest 20, 30 days), `visitCount` |
| `set_handle` | `{ name }` → `{ profile }` | Shared rule + word filter (`handle_invalid`); tag kept if free under the new name, else random (`handle_taken` when all 9,999 are used); the first change is free, then once per 30 days (`name_change_cooldown`) |
| `friend_request` | `{ name, tag }` → `{ status, person }` | Exact handle only; unknown or blocked either way → `not_found`; a request waiting the other way is accepted; `friend_limit` (100); notice + push `friends` |
| `friend_respond` | `{ userId, accept }` → `{}` | Accept notifies the requester (`friend_accepted`) |
| `friend_cancel`, `friend_remove` | `{ userId }` → `{}` | Own pending request / an accepted friendship |
| `block_user`, `unblock_user` | `{ userId }` → `{}` | Block deletes the friendship; requests, presence, visits and invites stop both ways; groups unchanged |
| `report_user` | `{ userId, reason, note?, context }` → `{}` | `reports` table for moderation |
| `get_island_snapshot` | `{ userId }` → `{ snapshot }` | Friends (or same group, Phase 8), not blocked (`blocked`, `not_friends`); records one visit per visitor per host per day |
| `together_create` | `{ plannedMs, invitees }` → `{ room }` | Invitees must be related; lobby 5 min; notice + push `together` |
| `together_room` | `{ roomId }` → `{ room }` | Participants only; states derived from their sessions; a stale lobby closes |
| `together_join`, `together_leave` | `{ roomId }` → `{ room }` | Join in the lobby or ≤ 2 min after the start (`room_closed`); the host leaving a lobby closes it |
| `together_start` | `{ roomId }` → `{ room }` | Host only (`not_owner`); then `start_session({ roomId })` gives everyone joined the room's start (≤ 30 s late) or, later within 2 min, their own start with the room's end |

### Phase 8: groups, ranking, missions, weekly settlement

| Op | Args → data | Notes |
|---|---|---|
| `group_state` | `{}` → `{ group, invites, rejoinAt }` | Settles passed weeks first. `group`: members with `rank` (ties share), `score` breakdown, `weekFocusMinutes`, `champion`; `mission` with milestones and contributions; `week.endsAt` |
| `group_create` | `{ name, timezone }` → `{ group }` | Name 2–24 chars + word filter (`handle_invalid`); IANA zone (`invalid`); `already_in_group`, `rejoin_cooldown`, `handle_required` |
| `group_join` | `{ code }` → `{ group }` | Code enabled (`not_found`); `group_full` (10); joining notifies members (push `groups`) |
| `group_invite` | `{ userId }` → `{}` | Any member invites a related user (`not_friends`); notice + push |
| `group_invite_respond` | `{ inviteId, accept }` → `{}` | Accept = join (same checks) |
| `group_code` | `{ action }` → `{ code, enabled }` | Owner: `regenerate`, `disable`, `enable` |
| `group_rename`, `group_set_war`, `group_transfer`, `group_remove_member`, `group_disband` | … → `{}` | Owner only (`not_owner`) |
| `group_leave` | `{}` → `{}` | Owner with other members: `invalid` (transfer first); the last member disbands. 24 h cooldown |

Jobs: `POST /job/weekly` (every 15 min) settles groups whose week ended (`runWeeklyJob`).

Phase 9 operations are added below.

## 4. Tables

Generated from `server/core/schema.ts` into `server/supabase/migrations/` (`npm run server:sql`; a test keeps them equal). Every table: key and filter columns plus the whole row as `data jsonb`. Owned tables add `user_id`, `updated_seq`.

Migration 3 (Phase 8): `groups` (unique `invite_code`), `group_members` (key `user_id`: one group per user), `group_invites`, `group_membership_log`, `weekly_results` (key `group|week|user`), `group_mission_weeks` (key `group|week`), `group_mission_contributions` (key `group|week|user`).

Migration 2 (Phase 7): `friendships` (key `low|high`, `status`, `requested_by`), `blocks` (key `blocker|blocked`), `reports`, `visits` (key `host|visitor|day`, `trace_kind`, `trace_payload`; 30-day retention in the hourly job), `together_rooms`, `together_participants` (key `room|user`).
