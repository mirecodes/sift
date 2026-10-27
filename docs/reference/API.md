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

Social operations (Phases 7–9) are listed in §4 as they are added.

## 4. Tables

Generated from `server/core/schema.ts` into `server/supabase/migrations/` (`npm run server:sql`; a test keeps them equal). Every table: key and filter columns plus the whole row as `data jsonb`. Owned tables add `user_id`, `updated_seq`.
