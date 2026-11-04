# Sift — Implementation Guidance v2

> Audience: the coding agent implementing Sift v2.
> Revision 3 (2026-10-07): owner decisions applied — mobile-ready DB/API (§2.11); `name#tag` identity with Korean support, separate friends and groups (§2.12, Phases 7–8); content-as-data pipeline for continuous skin/decoration releases (§2.13, Phase 3); group missions, presence, focus together, visit traces, lock-screen progress; war: defender-only Unicorn aura, Unicorns stay home, bracket-based gold loot (Phase 9); drag-and-drop arrangement later (Phase 10). Full list in §9.1.
> Baseline: `PROJECT_STATUS.md` as of 2026-10-07 (v0.1.0, M1–M6 done, M7 not started, local-only, IndexedDB schema v3, 329 unit tests).
> This document defines **what** to build, **in which order**, and the **rules** each step must respect. Where it fixes a default the owner has not confirmed, it says so and lists it in §9 (Open questions).

---

## 0. How to use this document

### 0.1 Read first
1. `ARCHITECTURE.md`, `DESIGN.md`, `DECISIONS.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
2. This file, §1–§4 completely, before starting any phase.
3. Only then the phase you are working on (§5–§8).

### 0.2 Working rules
- **One step = one commit (or one small PR)** with green tests and clean type checking. Never leave `main` broken between steps.
- **Phases are ordered by dependency.** Do not start a phase before the previous one is done, unless a step says it is independent.
- **Domain stays pure.** All new rules (stats, expiry, gold, scoring, war simulation, placement, occupancy) live in the domain layer with no browser, React, three.js or network imports, and get unit tests.
- **Every device or network feature goes through a platform adapter** (existing pattern). The backend is just another adapter (`RemotePort`, §2.1).
- **All tunable numbers live in one balance config** (§2.6). No magic numbers in components or simulations.
- **Tier logic uses rank, never names** (§2.8). Tier names have changed twice already.
- **The focus rule is extended, not relaxed:** nothing from v2 (gold, departures, rankings, war reports, weekly results) may appear, animate or sound during Focus. Such events are queued in the Inbox (§2.9) and shown on Home or Break.
- **Write an ADR** for every decision marked "ADR" below (next free number: **ADR-028**). Status `Proposed` when the owner has not confirmed it.
- **Update `CHANGELOG.md`** in every step, and fix any doc drift you touch.
- **Everything in code and docs is in English.** UI strings go into the existing strings file.
- **Feature flags:** each phase ships behind a flag in `config/app.yaml` (`features.stats`, `features.economy`, `features.cosmetics`, `features.islandMove`, `features.remoteContent`, `features.friends`, `features.presence`, `features.together`, `features.visitTraceProp`, `features.groups`, `features.missions`, `features.war`, `features.arrange`, `features.liveProgress`) so partially finished phases never reach users.
- **Mobile-ready from Phase 1 on** (§2.11): every new screen is responsive and touch-friendly, and every new device or network capability goes through an adapter, even before the iOS/Android shell exists.

### 0.3 Definition of done (every step)
- Unit tests for every new domain function, including edge cases listed in the step.
- Type check clean, all existing tests green.
- Acceptance criteria of the step verified (manually where visual; describe how in the commit message).
- `prefers-reduced-motion` respected for every new animation (crossfade or skip).
- Nothing new renders or plays during Focus.

---

## 1. Scope

| ID | Feature | Owner request | Phase |
|---|---|---|---|
| F1 | Tab navigation: Island (timer), Stats, Friends, Group | 1.1, rev 3 | 1 |
| F2 | Stats: monthly daily average, weekly 7-day view, monthly calendar | 1.2 | 1 |
| F3 | Gold economy: animals leave after 7 days and drop gold; coin pile; HUD counter | 4.1 | 2 |
| F10 | Content pipeline: content as data, authoring tools, Content Studio, sprite generation, validation, content packs | rev 3 decisions 5, 7 | 3 (remote packs in 5) |
| F4 | Cosmetics: animal skins, island block themes, decorations/buildings, shop with continuous releases | 3.1, 3.2, 4.3 | 3 |
| F5 | Island move: spend a Unicorn, rainbow bridge animation, new terrain | 4.2 | 4 |
| F6 | Backend, versioned API, accounts, sync (web, iOS and Android clients) | rev 2 | 5 |
| F9 | iOS and Android apps (M7): native adapters, push, deep links, lock-screen progress, store readiness | rev 2, rev 3 idea 5 | 6 |
| F7 | Identity (`name#tag`, Korean supported), friends, island visits, visit traces (mechanism), presence, focus together | 2.1, rev 3 | 7 |
| F11 | Groups: create / invite / leave, ranking, group missions, weekly reward | 2.2, rev 3 idea 1 | 8 |
| F8 | War inside a group: airship, battle, fall/vanish, defender Unicorn aura, gold loot | 2.3, rev 2, rev 3 | 9 |
| F12 | Arrange animals by drag and drop | rev 3 decision 2 | 10 (later) |

Phase 0 is preparation that every later phase depends on.

**Why this order.** Stats, economy, content/cosmetics and island move work fully on the device and reuse today's local-first architecture, so they deliver value early with low risk. The content pipeline comes with the first cosmetics because every later skin and decoration release depends on it. Backend and API come next, designed for all three clients at once, followed directly by the mobile shell, because invite links, push and native sign-in shape the social features. Then friends (the social graph), groups (built on friends), war (built on groups, scoring and visits), and finally manual arrangement of animals.

**Not planned for now (owner decision):** memory album for departed animals; any emotional framing of departures (animals simply leave gold and disappear).

---

## 2. Cross-cutting design decisions

### 2.1 Local-first, account-optional, server-authoritative when signed in (ADR)
- Without an account Sift works exactly as today: everything local.
- Social features (F7, F8) require an account. Once a user signs in, **the server is the source of truth** for animals, gold, cosmetics ownership, buildings and island state. IndexedDB becomes a cache plus an outbox.
- Reason: rankings, weekly rewards and war affect other people. A client-authoritative economy can be edited in IndexedDB, which would make those features meaningless.
- The backend is reached only through a platform adapter: `platform/remote/RemotePort.ts` (interface) with `SupabaseRemote` (real) and `FakeRemote` (tests, offline dev).

### 2.2 Island size becomes monotonic (ADR)
Today the island shape is computed from `seed + number of animals`. In v2 animals leave (expiry, war, island move), so the count can drop and the island would **shrink**, invalidating stored tile positions.

- Introduce `islandLevel = f(lifetimeEarnedCount)` where `lifetimeEarnedCount` counts every animal ever earned on this save, whatever its current status. Use the existing growth function, just change its input.
- The island never shrinks. It keeps its current maximum size.
- An island move (F5) keeps the level and changes only the seed.

### 2.3 Animal lifecycle (ADR)
Animals are no longer deleted. Add a status:

```ts
type AnimalStatus = 'active' | 'departed' | 'vanished' | 'spent';
// active    : on the island
// departed  : left after the lifetime expired, produced gold (F3)
// vanished  : lost for good after falling in a war (F8)
// spent     : a Unicorn consumed by an island move (F5)

interface PlacedAnimal {
  id: string;                  // UUID (existing)
  speciesId: string;
  tierRank: 0 | 1 | 2 | 3;     // see 2.8
  tile: { x: number; z: number };
  earnedAt: string;            // UTC ISO (existing)
  sessionId: string;           // existing
  status: AnimalStatus;        // NEW, default 'active'
  endedAt: string | null;      // NEW, when status left 'active'
  endReason: 'expired' | 'war' | 'island_move' | null; // NEW
  verified: boolean;           // NEW, true for local-only saves; see 7.5
}
```

- The island renders **only `active`** animals.
- The Collection counts **all** animals ever earned (`×3` = three earned, whatever happened to them). Discovered species never become undiscovered.
- "Fallen" during a battle is a transient state inside the simulation, not a stored status. A fallen animal that does not vanish returns home unchanged.

### 2.4 Renderer draws an `IslandModel`, not "my store" (ADR)
F5 shows two islands at once, F7 shows a friend's island, F8 shows an attacker plus a defender island. So the 3D world must render from a plain data object:

```ts
interface IslandModel {
  ownerId: string | 'local';
  seed: number;
  islandLevel: number;
  blockThemeId: string;
  animals: Array<{ id: string; speciesId: string; tierRank: number; tile: Tile; skinId: string }>;
  buildings: Array<{ id: string; defId: string; tile: Tile; rotation: 0 | 90 | 180 | 270 }>;
  goldPileLevel: number;       // 0..N visual bucket, not exact gold
  championWeek?: string;       // shows the champion flag (F11)
}
type IslandMode = 'own' | 'visit' | 'battle' | 'move';
```

`buildIslandModel(...)` is pure (domain). `<IslandScene model mode>` renders it. The existing single-scene continuity across Home/Focus/Break must be preserved.

### 2.5 One occupancy grid (ADR)
Several systems need to know what is on a tile: terrain height, stream water, camp (campfire + cabin + coin pile reserve), buildings, animals. Today these checks are scattered, which is why old saves overlap the camp and stream (status 6.3).

- Add `domain/island/occupancy.ts`: `getOccupancy(model): Map<TileKey, TileInfo>` with `{ height, water, campReserved, buildingId?, animalIds[], walkable, buildable }`.
- Animal placement, building placement, focus-routine walking, war formation and island move all use it.

### 2.6 Balance config (ADR)
A single typed module, e.g. `shared/balance/balance.ts`, exporting a frozen object plus a `BALANCE_VERSION` string. Contents are listed in §8. The server imports the **same file** (§2.7) and stores `BALANCE_VERSION` with every war and weekly settlement so old replays stay reproducible.

### 2.7 Shared, deterministic rules (ADR)
- Create a `shared/` folder (or package) for logic that must run identically on client and server: seeded RNG, reward roll, expiry, scoring, placement, war simulation, balance config.
- Code there must be plain TypeScript with zero browser or Node specifics, so it can be bundled into server functions (Deno for Supabase Edge Functions).
- Use one seeded PRNG implementation (e.g. a small 32-bit generator such as mulberry32 or sfc32). Never call `Math.random()` inside shared rules.
- Check how the existing domain RNG is built and reuse or move it rather than adding a second one.

### 2.8 Tier rank, not tier name
Add (or verify) `tierRank: 0 | 1 | 2 | 3` (Common 0, Mythic 1, Epic 2, Legendary 3). Scoring, gold, war odds and visuals key off the rank. A grep for tier-name string comparisons in logic should come back empty at the end of Phase 0.

### 2.9 Inbox: deferred notices (ADR)
A domain queue of things to tell the user later:

```ts
type Notice =
  | { kind: 'animals_departed'; animalIds: string[]; gold: number }
  | { kind: 'weekly_result'; groupId: string; weekStart: string; winnerIds: string[]; youWon: boolean; gold: number }
  | { kind: 'war_report'; warId: string; role: 'attacker' | 'defender'; result: 'win' | 'loss' }
  | { kind: 'joined_group' | 'removed_from_group'; groupId: string }
  | { kind: 'friend_request' | 'friend_accepted'; userId: string }
  | { kind: 'group_invite'; groupId: string; inviterId: string }
  | { kind: 'mission_milestone'; groupId: string; weekStart: string; milestone: number; gold: number }
  | { kind: 'together_invite'; roomId: string; hostId: string }
  | { kind: 'war_loot'; warId: string; gold: number /* + gained, - lost */ };
```

- Persisted (local store, later also server table).
- Shown only when the phase is `idle` (Home) or `break`, one at a time, as a small card over the island. Never during Focus.
- Visual events tied to a notice (coins flying to the pile, champion flag appearing) play when the notice is shown, not when the data changed.

### 2.10 Tabs and the 3D canvas
Four tabs: **Island**, **Stats**, **Friends**, **Group** (the last two hidden until their feature flags are on). The canvas stays mounted at all times (continuity, no re-init cost). When Stats is active the canvas is covered and its render loop is paused (`frameloop` on demand / never). Friends and Group reuse the canvas for island visits.

### 2.11 Mobile as a first-class target (ADR, owner decision rev 2)
Sift will ship on iOS and Android via Capacitor (one web codebase). Consequences for every phase:
- **One code path.** No feature may depend on desktop-only input (hover, right-click, keyboard-only actions). Keyboard shortcuts stay as extras.
- **Adapters for everything native:** storage, secure storage, lifecycle, local and push notifications, deep links, haptics, lock-screen progress (Step 6.2). Web and native implementations pass the same contract tests.
- **Durable local store on native:** SQLite-backed storage adapter with the same schema and migrations as IndexedDB.
- **The API is a versioned contract** used by several app versions at once: version gate, idempotent mutations, typed errors, server time, delta sync (Step 5.2).
- **Store requirements are designed in, not bolted on:** Sign in with Apple, in-app account deletion, moderation of user-generated names, block and report, privacy labels (Steps 5.4, 6.7, 7.2).
- **Content ships without app updates** where possible (§2.13), because store review delays releases.
- **Performance budget includes mid-range phones** (Step 9.9).

### 2.12 Social graph: identity, friends, groups (ADR, owner decision rev 3)
- Every account has a public **handle `name#tag`** (e.g. `민지#4821`, `Mina#0193`). Korean names are supported (Step 7.1).
- **Friends** are a mutual, request/accept relation found by exact handle. Friends can visit each other's islands, see presence and focus together. Friends never compete with each other.
- **Groups** are a separate unit that members create, invite to and leave. **Ranking, weekly reward, group missions and war exist only inside a group.** Group members can visit each other's islands even if they are not friends.
- One group per user in v2 (§9.2).

### 2.13 Content is data (ADR, owner decision rev 3)
Skins and decorations will be released continuously. Therefore:
- Every species, skin, skin family, block theme and building/decoration is a **data file** under `content/`, validated by a schema. Game code reads items only through a `ContentRegistry`, never by importing a specific item.
- Visual behavior comes from **code presets referenced by id** (particles, part animations, lights, idle sets). A new item never needs code unless it needs a new preset.
- Items are bundled into **content packs** with a `contentVersion`. The app ships a baseline pack; newer packs are downloaded from the server (Step 5.8), so new items reach phones without an app release. Items that need a newer renderer declare `minClientVersion` and stay hidden on older apps.
- Authoring, preview, sprite generation and validation are tooled (Steps 3.1–3.5) so a release is: author → preview → validate → generate → publish.

### 2.14 Presence and the focus rule (ADR)
The focus rule stays: nothing appears, animates or sounds during Focus. The **only** exception is passive, static information the user explicitly opted into: the participant line of a focus-together session (Step 7.7) and the OS lock-screen progress (Step 6.8). These update silently, never animate, never sound and never pop up.

---

## 3. Target structure

Adapt names to the existing tree; the point is the separation.

```
content/                      # data only (§2.13)
  species/ skins/ skinFamilies/ blockThemes/ buildings/ releases/
  presets.json                # ids of code presets items may reference
shared/                       # pure, runs on client and server
  balance/balance.ts          # all tunables + BALANCE_VERSION
  content/schema.ts           # zod schemas + inferred types for content
  api/types.ts                # request/response types for every endpoint
  rng/                        # seeded PRNG
  rules/
    reward.ts                 # existing tier/species roll, moved here
    expiry.ts                 # F3
    handle.ts                 # name#tag validation and normalization (F7)
    scoring.ts                # F11
    missions.ts               # group mission targets and milestones (F11)
    placement.ts              # animal tile choice (moved), uses occupancy
    war/simulate.ts war/formation.ts war/loot.ts   # F8
tools/
  vox-import/                 # MagicaVoxel .vox -> model JSON (Step 3.3)
  content-build/              # builder DSL, skin family expansion, pack build
  sprite-gen/                 # headless sprite and atlas generation (Step 3.5)
src/
  domain/
    stats/aggregate.ts        # F2
    island/occupancy.ts       # 2.5
    island/model.ts           # buildIslandModel (2.4)
    economy/ledger.ts         # F3
    content/registry.ts       # ContentRegistry (baseline + remote packs)
    inbox/                    # 2.9
  store/                      # add: activeTab, wallet, inventory, inbox, friends, group, presence, war slices
  screens/
    tabs/AppShell.tsx         # F1
    stats/                    # F2
    shop/                     # F4
    collection/               # skins/themes (F4)
    build/                    # build mode (F4), arrange mode (F12)
    friends/                  # F7
    group/                    # F11, F8 (Ranking | Missions | Wars | Members)
    studio/                   # Content Studio, dev builds only (F10)
  world/
    IslandScene.tsx           # renders IslandModel
    presets/                  # particle, part-animation, light presets (§2.13)
    sequences/
      departures.ts           # F3
      islandMove.ts           # F5
      warVoyage.ts battleReplay.ts   # F8
    props/                    # coin pile, airship, rainbow bridge, buildings, champion flag, loot chest
  platform/
    remote/RemotePort.ts      # implements the API contract
    remote/SupabaseRemote.ts remote/FakeRemote.ts
    storage/                  # IndexedDB (web) + SQLite (native), shared contract tests
    secureStorage/ lifecycle/ notifications/ push/ deepLinks/ haptics/ liveProgress/   # Phase 6
server/                       # Supabase project (migrations, RPC SQL, edge functions)
  API.md                      # endpoint contract (Step 5.2)
docs/CONTENT.md               # content authoring and release guide (Step 3.5)
ios/ android/                 # Capacitor native projects (Phase 6)
```

---

## 4. Data model changes

### 4.1 Local store (schema v4, one migration)
| Store | Change |
|---|---|
| `placedAnimals` | add `status='active'`, `endedAt=null`, `endReason=null`, `verified=true`, `pinned=false` (Phase 10) to every existing row; add `tierRank` if not stored. Skins are per species (`equipped`), not per animal |
| `focusSessions` | add index on `startedAt` (stats); add `togetherRoomId=null` |
| `world` | `islandLevel` is **derived**, do not store; add `blockThemeId='default'` |
| `ledger` (new) | `{ id, at, currency:'gold', amount, reason, refId }` |
| `cosmetics` (new) | owned items `{ id, kind:'animalSkin'|'blockTheme'|'building', defId, acquiredAt, source }` |
| `equipped` (new, singleton) | `{ skinBySpecies: Record<speciesId, skinId>, blockThemeId }` |
| `placedBuildings` (new) | `{ id, defId, tile, rotation, placedAt }` |
| `islandHistory` (new) | `{ id, seed, from, to }` (F5) |
| `inbox` (new) | notices (2.9) |
| `contentPacks` (new) | downloaded packs `{ contentVersion, checksum, json, atlas, fetchedAt }` (Step 5.8) |
| `settings` | add `weekStartsOn: 1` (Monday), `showFocusPresence: true`, `liveProgress: true` |

Write the migration so it is safe to run on a v3 database with real data, and test it with a fixture v3 database. On iOS/Android the same stores and migrations are served by the SQLite-backed storage adapter (Step 6.2), so keep migrations expressed through the storage adapter, not raw IndexedDB calls.

### 4.2 Server schema (Phase 5 onward, Postgres)
| Table | Purpose |
|---|---|
| `profiles` | user id, `handle_name` (display form), `handle_key` (normalized), `handle_tag` (0001–9999), unique (`handle_key`, `handle_tag`), `name_changed_at`, avatar species, `show_presence`, created_at |
| `island_state` | user id, seed, block theme, updated_at |
| `sessions` | server-timestamped focus sessions (+ `together_room_id`) |
| `animals` | same shape as local `PlacedAnimal` + `user_id` |
| `ledger` | gold transactions |
| `cosmetics_owned`, `equipped`, `placed_buildings`, `island_history` | as local |
| `friendships` | `user_low`, `user_high`, status (`pending`/`accepted`), `requested_by`, created_at, accepted_at |
| `blocks` | blocker, blocked, created_at |
| `groups` | id, name, owner_id, invite_code, invite_code_enabled, timezone, war_enabled, created_at |
| `group_members` | group_id, user_id, role (`owner`/`member`), joined_at; unique user_id (one group per user) |
| `group_invites` | group_id, inviter_id, invitee_id, status, created_at |
| `group_membership_log` | joins/leaves for eligibility and cooldown checks |
| `weekly_results` | group_id, week_start, user_id, score, focus_minutes, rank, rewarded, balance_version |
| `group_mission_weeks` | group_id, week_start, member_count, target_minutes, progress_minutes, milestones_reached, balance_version |
| `group_mission_contributions` | group_id, week_start, user_id, minutes |
| `together_rooms`, `together_participants` | focus-together rooms (Step 7.7) |
| `visits` | host_id, visitor_id, at, trace_kind, trace_payload (jsonb) (Step 7.5) |
| `wars` | id, group_id, attacker_id, defender_id, seed, balance_version, armies (jsonb), rounds (jsonb), result, loot_gold, created_at |
| `content_releases` | content_version, pack url, checksum, min_client_version, published_at (Step 5.8) |
| `notices` | inbox rows per user |
| `devices` | push token, platform, app version, locale per device (Phase 6) |
| `api_requests` | idempotency results by `requestId` (48 h) |
| `app_config` | `min_supported_api_version`, rate limits, push toggles |
| `reports` | user reports for moderation (Step 7.2) |

Every user-owned table carries `updated_seq` (monotonic per user) for delta sync, and `created_at`/`updated_at` in UTC.

Row-level security: a user reads and writes only their own rows; **friends and members of the same group** may read each other's island snapshot and presence through RPCs only; blocked users never can. **Clients may never insert or update `animals`, `ledger`, `cosmetics_owned`, `weekly_results`, `group_mission_*`, `wars` directly.** These change only through RPCs or edge functions.

---

## 5. Phase 0 — Foundations

Goal: make the codebase ready for v2 without visible feature changes, and fix the two release blockers.

### Step 0.1 — Developer switches can never reach users
- `testMode` and `resetMapOnStart` are honored only in development builds (check the build tool's dev flag). Production builds force both to `false` regardless of `config/app.yaml`.
- Set both to `false` in the committed `app.yaml`; document how to enable locally.
- **Accept:** a production build with both set to `true` in yaml keeps saved animals across reloads.

### Step 0.2 — Export / import backup
- Settings → "Export data" downloads a versioned JSON (`{ format: 'sift-backup', version: 1, exportedAt, data: {...all stores} }`).
- "Import data" validates format/version, shows a summary (sessions, animals), asks for confirmation, replaces all local data atomically.
- **Accept:** export → clear site data → import restores island, stats and settings exactly.

### Step 0.3 — Schema v4 migration (§4.1)
- Add all new stores and fields now, even if unused until later phases, so there is one migration.
- **Tests:** migrate a v3 fixture; all existing animals become `active`, `verified=true`; nothing else changes.

### Step 0.4 — Tier rank everywhere (§2.8)
- **Accept:** no logic compares tier names; tests cover the rank mapping.

### Step 0.5 — Shared module + seeded RNG + balance config (§2.6, §2.7)
- Move the reward roll and placement into `shared/`. Create `balance.ts` with the current reward odds and timer limits; later phases add their sections.
- **Accept:** all 329 existing tests still pass, unchanged reward odds.

### Step 0.6 — Monotonic island level (§2.2)
- Replace the "animal count" input of island generation with `lifetimeEarnedCount`.
- **Tests:** marking animals `departed` never changes the generated terrain; the same save still produces the same island as before the change.

### Step 0.7 — Occupancy grid + save repair (§2.5)
- Implement `getOccupancy`. Reserve one tile next to the cabin for the coin pile (`campReserved`).
- On load, any active animal on a non-placeable tile (water, camp, reserved) is moved to the nearest free tile and the new position is saved. This fixes "old saves overlap new features".
- **Tests:** overlapping fixture gets repaired; repair is idempotent.

### Step 0.8 — `IslandModel` + `<IslandScene model mode>` (§2.4)
- Refactor the world layer to render from `IslandModel`. Behavior must look identical.
- Add a dev-only route/flag that renders two islands side by side from two seeds, to prove the renderer has no hidden global state (needed by F5, F7, F8).
- **Accept:** visual parity on Home, Focus, Break, day and night; two-island dev view works.

### Step 0.9 — Inbox infrastructure (§2.9)
- Store + a `NoticeCard` component on Home/Break. Store guard: notices are never dequeued while phase is `focusing`.
- **Tests:** notices queued during Focus show after Focus ends.

---

## 6. Phases 1–4 — Local features

### Phase 1 — Tabs and Stats (F1, F2)

#### Step 1.1 — App shell with tabs
- Tabs: **Island** (today's Home/Focus/Break), **Stats**, **Friends** (hidden until `features.friends`), **Group** (hidden until `features.groups`). Build the shell for four tabs now so later phases only switch flags.
- Tab bar placement: follow `DESIGN.md`; a slim bar at the bottom center is suggested, matching the existing icon style.
- Visibility rules:
  - Focus: tab bar hidden (focus rule).
  - Break: tab bar visible. On other tabs a small pill shows the running break timer ("Break 03:12"); tapping it returns to Island.
  - Space (main action) and hold-Esc work only on the Island tab.
- `activeTab` lives in the store, persisted for the session only. Canvas behavior per §2.10.
- **Accept:** switching tabs never resets the scene, never affects the timer, and the canvas consumes no frames while Stats is shown.

#### Step 1.2 — Stats aggregation (domain)
```ts
interface DayStat { date: string /* YYYY-MM-DD local */; focusMinutes: number; sessionCount: number }
aggregateByDay(sessions, { timeZone, from, to }): DayStat[]   // one entry per day, zeros included
monthSummary(dayStats, { today }): { totalMinutes, dailyAverage, activeDays, bestDay }
```
Rules (defaults, ADR):
- Only `completed` sessions count. Abandoned sessions are excluded (`balance.stats.includeAbandoned=false`).
- Minutes = actual focused time `endedAt - startedAt` (planned + overtime), **not** the 60-min reward cap.
- A session belongs to the local calendar day on which it **started** (no splitting at midnight).
- Times are stored in UTC; bucket with the user's current time zone (`Intl`). Use a small date library (e.g. date-fns + tz) rather than hand-rolled date math.
- Monthly daily average = total minutes in the month ÷ days elapsed (current month: day 1 through today inclusive; past months: days in month).
- **Tests:** session across midnight, DST change weeks (Europe/Zurich last Sunday of March and October), empty month, current month average, week starting Monday vs Sunday.

#### Step 1.3 — Stats tab: Overview
- Month selector (← October 2026 →, no future months).
- Large figure: **daily average** for the month (e.g. `1h 42m / day`). Smaller: total this month, active days, best day.
- Below: compact 30-bar strip of the month for context.

#### Step 1.4 — Stats tab: Week
- 7 columns (week starts per `settings.weekStartsOn`, default Monday). Each column: weekday + date, a bar scaled to the week's max, focus time (`2h 05m`), session count (`×4`). Today highlighted.
- Week header with navigation and week total / daily average.
- Clicking a day opens the Day detail (1.6).

#### Step 1.5 — Stats tab: Month calendar
- Calendar grid for the month. Each cell: date, focus time, session count; background intensity by minutes (heatmap, 4–5 steps from design tokens). Text always present so color is not the only signal.
- Navigation by month; future days greyed.

#### Step 1.6 — Day detail
- Sheet listing that day's sessions: start time, length (+overtime), and the reward sprite if any. Abandoned sessions shown greyed as "stopped", not counted.

#### Step 1.7 — Settings
- Add "Week starts on" (Monday / Sunday).

Implementation notes: plain SVG/CSS for bars and calendar (no chart library); all strings in the strings file; keyboard navigable.

---

### Phase 2 — Gold economy (F3)

#### Step 2.1 — Ledger and wallet (domain + store)
- `ledger.ts`: append-only entries; `balance = sum(amount)`, cached in the store, recomputed on load.
- `spendGold(amount, reason, refId, grant)` writes the debit and the granted item in **one transaction** or fails entirely (insufficient balance → typed error).
- Optional starter grant once on migration/first run: `balance.economy.starterGold` (default 30, see §9 Q12).

#### Step 2.2 — Expiry engine (shared rule)
```ts
computeExpirations(animals, now, cfg) => Array<{ animalId; expiredAt; gold }>
```
- An `active` animal expires at `earnedAt + cfg.animalLifetimeDays` (default **7 days**).
- **Exempt:** Unicorn (it is the special currency, F5). Configurable list `cfg.expiryExemptSpecies = ['unicorn']`.
- Gold left by tier rank: `[1, 3, 8, 25]` (Common, Mythic, Epic, Legendary).
- `endedAt` = the real expiry moment, not the moment it was applied.
- Apply via one atomic write: statuses → `departed`, ledger credits, one `animals_departed` notice.
- When to run: app start, on transition to Home or Break, and every 60 s while idle. **Never while focusing**; animals that expire during Focus are applied when Focus ends.
- **Tests:** boundary exactly at 7 days, exempt species, long absence (many expired at once), idempotency (running twice gives gold once), nothing applied during `focusing`.

#### Step 2.3 — Departure presentation
- Keep it simple and neutral (owner decision rev 3): animals leave gold and disappear. No farewell scenes, no sentimental copy, no memory album.
- When the `animals_departed` notice is shown:
  - Card: "4 animals left 9 gold." (one animal: "Fox left 1 gold.").
  - Animation: each leaving animal poofs into a small puff; a coin voxel arcs from its tile into the coin pile; the HUD counter counts up.
  - At most 10 animated departures; the rest disappear instantly with one combined coin burst.
- Reduced motion: no arcs, counter updates directly.

#### Step 2.4 — Coin pile prop
- Placed on the reserved camp tile next to the cabin (§Step 0.7).
- Visual level from gold balance via thresholds `balance.economy.pileThresholds = [1, 10, 30, 100, 300, 1000]` → 0–6 pile sizes made of gold voxel stacks. Never one mesh per coin.
- At night it catches the campfire light (subtle sparkle).

#### Step 2.5 — HUD counters
- Top bar: gold icon + amount, unicorn icon + count of `active` unicorns. Hidden during Focus, like the rest of the top bar.
- Tapping gold opens the Shop (Phase 3; until then, a tooltip explaining gold).

#### Step 2.6 — Collection and poke updates
- Collection counts stay all-time. Add "on island: n" per species.
- Poking an animal shows its remaining time in the "!" bubble (e.g. "3d left"); Unicorn shows no timer.

---

### Phase 3 — Content pipeline, cosmetics, buildings, shop (F10, F4)

Goal: releasing a new skin or decoration must be cheap and safe: one or two data files plus generated sprites, checked automatically, no code (§2.13). Steps 3.0–3.5 build the pipeline; Steps 3.6–3.13 build the features on top of it.

#### Step 3.0 — Palette keys in voxel models (prerequisite)
Inspect how species models store colors. If they use raw colors, refactor every model to named palette keys (`body`, `belly`, `accent`, `eye`, `horn`, …) with a default palette per species. Visual parity is required. Same for terrain blocks (`grassTop`, `grassSide`, `dirt`, `stone`, `sand`, `waterTint`, `cabinWood`, `cabinRoof`, …).

#### Step 3.1 — Content format, registry and packs
- Move the 50-species catalog and all new content into `content/` as JSON, validated by zod schemas in `shared/content/schema.ts`:
```ts
interface ItemBase {
  id: string; kind: string;
  name: { en: string; ko: string };            // both locales from day one
  price?: number; purchasable: boolean;
  release: string;                              // release id, e.g. "2026-11-autumn"
  availableFrom?: string; availableUntil?: string;   // limited items
  minClientVersion?: string;                    // needs a newer renderer/preset
  tags?: string[];
}
interface AnimalSkinDef  extends ItemBase { kind: 'animalSkin'; speciesId: string; family?: string;
                                            palette: Partial<Record<PaletteKey, Color>>; overlay?: ModelRef }
interface SkinFamilyDef  { id: string; name: { en: string; ko: string };
                           transform: PaletteTransform;            // hue shift, lightness curve, fixed colors per key
                           priceByTierRank: number[]; overrides?: Record<speciesId, Partial<AnimalSkinDef>> }
interface BlockThemeDef  extends ItemBase { kind: 'blockTheme'; palette: Record<BlockPaletteKey, Color>;
                                            waterTint?: Color; cloudTint?: Color; ambient?: PresetId }
interface BuildingDef    extends ItemBase { kind: 'building'; category: 'decor' | 'structure' | 'nature' | 'light' | 'special';
                                            footprint: { w: number; d: number }; model: ModelRef;
                                            rotatable: boolean; allowOnWater?: boolean;
                                            parts?: Array<{ name: string; preset: PresetId }>; light?: PresetId }
```
- **Skins are per species**: equipping applies to every animal of that species (§9.2 Q13).
- **Skin families** (Golden, Snowy, Shadow, Pastel, Ghost, …) are palette transforms expanded at build time into one skin per species (`family:speciesId`), with optional per-species overrides. Handcrafted skins (e.g. "White Tiger") are ordinary `AnimalSkinDef` files.
- `tools/content-build` bundles everything into a **content pack**: `{ contentVersion, items[], models{}, atlas }`. The app bundles a **baseline pack**; `ContentRegistry` loads it and later merges remote packs (Step 5.8). Items outside their availability window or above the running `minClientVersion` are hidden.
- **Tests:** schema accepts all shipped content; registry merge (newer version wins, removed items stay owned and renderable); availability filtering; family expansion produces 50 skins with stable ids.

#### Step 3.2 — Behavior presets
- A code registry of reusable behaviors referenced by id: idle animation sets, part animations (`spin`, `sway`, `bob`, `flap`), particle emitters (`sparkle`, `rainbow`, `smoke`, `leaves`, `snow`, `fireflies`), lights (`lantern_glow` at night).
- Items reference presets by id in `parts`, `light`, `ambient`. An unknown preset id fails validation.
- Adding a preset is a code change shipped with an app release; items using it set `minClientVersion`.

#### Step 3.3 — Authoring paths
- **MagicaVoxel import** (organic shapes: animals, skins with overlays, statues): `tools/vox-import` converts `.vox` to model JSON. A template file `palette-template.vox` reserves palette indices for palette keys (documented mapping). Named objects/layers become `parts` (e.g. `wing_L`, `blade`); a reserved marker color sets the pivot. Unknown colors or missing parts fail with clear messages.
- **TypeScript builder DSL** (geometric decor: fences, lanterns, wells, signs): `box`, `cylinder`, `stairs`, `mirrorX`, `paint(key)`; `npm run content:build` evaluates builders to the same model JSON. The coding agent can author simple decorations this way without art tools.
- Both paths produce identical JSON; the renderer never knows which was used.

#### Step 3.4 — Content Studio (development builds only)
- A `/studio` route compiled only into development builds (same guard as Step 0.1).
- Browse all items with filters (kind, release, family, missing sprite, validation errors).
- Preview: model on a test island, day/night, every block theme, rotation, presets running.
- Skin family editor: one family across all 50 species as a grid; adjust the transform; per-species overrides; live update.
- Building tester: footprint overlay, placement validity on sample terrains, rotation.
- Edit names, prices, tags, availability; save writes back to `content/` through the dev server. Hot reload on file change.

#### Step 3.5 — Sprite generation, validation, release process
- `npm run content:sprites`: headless rendering (reuse the Playwright setup from `npm run e2e`) of every (species, skin), building and theme swatch with an orthographic camera → pixel-art sprites (fixed size, nearest-neighbor, palette-limited) → atlases in the pack. Regenerate the existing collection sprites the same way so old and new sprites match (§9.2 Q33).
- `npm run content:validate`, run in CI on every commit: schema; unique ids; all references resolve (species, presets, models); palette keys exist; budgets (animal model ≤ 16×16×16 and ≤ 800 voxels; building footprint ≤ 3×3, height ≤ 24, ≤ 3,000 voxels; tune in the ADR); footprint matches model bounds; both locales present; price inside the `prices` ranges (§8); sprites present; availability dates valid.
- `docs/CONTENT.md`: step-by-step release guide: author (MagicaVoxel or DSL) → check in Studio → validate → generate sprites → add items to `content/releases/<id>.json` → build pack → (from Phase 5) publish (Step 5.8) → verify on staging → production.

#### Step 3.6 — Initial content set
- Block themes: Default (free), Autumn, Snow, Desert, Cherry Blossom.
- Buildings/decorations: Fence segment, Lantern, Flower bed, Well, Small tree, Stone statue, Windmill (`spin` preset on `blade`), Footbridge (`allowOnWater`), plus the non-purchasable Champion Flag (F11).
- Skin families: Golden, Snowy, Shadow, Pastel, Ghost; handcrafted: White Tiger, Night Unicorn.
- Ship them as release `v2-launch` through the pipeline above (this is also the pipeline's end-to-end test).

#### Step 3.7 — Inventory and equip (domain + store)
- Owned items in `cosmetics`; buildings can be owned multiple times (count of instances).
- `equipped.skinBySpecies`, `equipped.blockThemeId`. Default skin and default theme are always owned.
- Owned items stay usable even if a later pack removes them from the shop.

#### Step 3.8 — Rendering skins and themes
- Mesh build applies `species default palette ← skin palette` and appends overlay voxels. Cache built geometry per `(speciesId, skinId)`; keep the current instancing approach.
- Collection and shop use the generated atlas sprites.
- Block theme swaps terrain colors (and water/cloud tint) without rebuilding terrain geometry where possible.

#### Step 3.9 — Shop screen (built for continuous releases)
- Opens from the HUD gold counter (Home and Break only).
- Top: **Featured** row from the newest release file; **New** badge for items released in the last 14 days; limited items show "Leaves in 3d".
- Sections: Animal skins (only species you have found), Island themes, Decorations & buildings (by category).
- Item card: preview (spinning model for skins/buildings, small island preview for themes), name, price, Buy / Owned.
- Buy → confirm → `spendGold` (atomic). Not enough gold → disabled button with "Need 12 more".

#### Step 3.10 — Collection: choose skins and island theme
- Species detail panel: list of skins (owned → Equip; not owned → price + "Open shop").
- Top of Collection: "Island theme" selector with owned themes.
- Equipping updates the island immediately.

#### Step 3.11 — Build mode (placing buildings)
- Entry: hammer icon on Home (not on Focus or Break).
- Camera stays isometric; rotation allowed. A bottom tray shows owned, unplaced buildings with counts.
- Select → ghost follows the pointer/finger, snapped to tiles (raycast against the terrain grid). Tint green/red by validity. `R` or a button rotates 90°.
- Validity (via occupancy): all footprint tiles on the island, same height, not water (unless `allowOnWater`), not camp/reserved, no other building, and the island keeps at least `balance.build.minFreeTiles` free tiles for animals.
- Tiles occupied by animals are allowed: on confirm, those animals hop to the nearest free tile.
- Tap a placed building → Move / Rotate / Store (back to tray). Esc or "Done" exits.
- Persist `placedBuildings`. Phase 10 extends this mode to animals.

#### Step 3.12 — Pathfinding for walking animals
Buildings make the existing straight-line walking (status 6.3) worse. Add grid A* over walkable tiles (height step ≤ 1, no water except bridge tiles, no buildings, cabin door tile is the goal for day routines). Fall back to the current behavior if no path exists.

#### Step 3.13 — Animal placement with buildings
New animals pick free tiles via occupancy. If no free tile exists, they share a tile with sub-tile offsets (max 4 per tile) rather than failing.

---

### Phase 4 — Island move with a Unicorn (F5)

#### Step 4.1 — Domain
```ts
moveIsland(state, newSeed): Result<MoveOutcome, 'no_unicorn' | 'not_idle'>
```
- Preconditions: phase `idle` (Home), at least one `active` Unicorn.
- Effects, in one transaction:
  - The oldest active Unicorn → `spent`, `endReason='island_move'`.
  - World seed → `newSeed`; `islandLevel` unchanged (§2.2).
  - `islandHistory` row for the old seed.
  - All active animals get new tiles via the placement rule on the new terrain.
  - All placed buildings return to inventory (terrain differs; ADR, see §9 Q15).
  - Expiry clocks are unchanged.
- Optional: "Preview a new island" generates seeds and shows them before paying; up to `balance.islandMove.freePreviews` (default 3) rerolls before confirming.

#### Step 4.2 — Confirm UI
Dialog: "Move to a new island? This uses 1 Unicorn. Buildings will return to your inventory." Shows unicorn count and the preview.

#### Step 4.3 — Move sequence (world)
A timeline (`sequences/islandMove.ts`), driven by already-committed data; total ≈ 12–15 s, with Skip.
1. **Reveal:** camera pulls back; the new island fades in to the side, slightly lower, across open sky.
2. **Rainbow bridge:** the spent Unicorn walks to the island edge facing the new island, leaps and flies across; behind it a rainbow trail (six colored voxel stripes) solidifies progressively into an arched bridge along a curve between the two edges. Unicorn rainbow particles intensify.
3. **Crossing:** animals line up at the bridge start (nearest first) and walk across single file with spacing; flying species fly alongside; the fish hops. With more than ~30 animals, increase walking speed and spawn rate so the crossing lasts ≤ 6 s.
4. **Arrival:** animals hop off and walk to their new tiles. The Unicorn reaches the far end and dissolves into rainbow sparkles (it is spent).
5. **Farewell:** the bridge dissolves from the old end, the old island sinks and fades into the clouds, the camera recenters on the new island; the coin pile and camp appear on the new island.
- Requires two `IslandModel`s rendered at once (Step 0.8).
- Reload during the sequence simply shows the new island (data is already committed).
- Reduced motion: crossfade old → new island.

---

## 7. Phases 5–10 — Backend, mobile, social features

### Phase 5 — Backend, API, accounts, sync (F6)

Everything in this phase is designed from day one for **three clients**: desktop web, iOS app and Android app (the same web code wrapped with Capacitor, §2.11). Nothing in the API may rely on browser-only behavior: no cookie sessions, no same-origin redirects, no tokens in plain web storage on native.

#### Step 5.1 — Backend choice (ADR)
Recommended: **Supabase** (Postgres, Auth with email one-time codes plus Apple and Google sign-in including native ID-token flows, row-level security, Postgres RPC functions, Edge Functions in Deno/TypeScript, scheduled jobs). Reasons: relational data (groups, rankings, wars) fits Postgres; edge functions run the `shared/` rules unchanged; the JS client works inside a Capacitor app over plain HTTPS. Alternative: Firebase (document model, weaker for rankings and multi-row transactions). Region: EU. Verify current SDK and plugin versions in the official docs before starting; do not rely on memory.

#### Step 5.2 — API contract (ADR)
The API is a product surface shared by app versions that will coexist for months (store review, users who do not update). Treat it as a versioned contract.

- **Named endpoints only.** Clients call named RPCs / edge functions; they never write tables directly and read other users' data only through endpoints. Document every endpoint in `server/API.md`; request/response types live in `shared/api/types.ts` and DB types are generated from the schema.
- **Client identification and version gate.** Every request sends `x-sift-client: <platform>/<appVersion>/<apiVersion>`. The server compares with `app_config.min_supported_api_version` and answers `client_outdated`; the client then shows a blocking "Please update Sift" screen (store link on native, reload on web). Keep endpoints backward compatible within an API version; add fields, never repurpose them.
- **Idempotency.** Every mutating call carries a client-generated `requestId` (UUID). The server stores the result in `api_requests` for 48 h and returns the stored result on a retry. Mobile networks drop responses; a retry must never double-reward, double-charge or declare two wars.
- **Typed errors.** Stable codes (`insufficient_gold`, `cooldown_active`, `shield_active`, `not_in_group`, `session_already_running`, `war_disabled`, `client_outdated`, `rate_limited`, …) mapped to UI strings on the client. Never display raw server messages.
- **Server time.** Every response includes `serverNow`. The client keeps the offset and uses it for countdowns (weekly settlement, cooldowns, shields), so a changed phone clock has no effect.
- **Delta sync.** Every user-owned row has a monotonic `updated_seq`. `sync_pull(sinceSeq)` returns only what changed, so app resumes on mobile data are cheap.
- **Small payloads.** Island snapshot ≤ ~50 KB; history lists use cursor pagination.
- **Rate limits** per user per endpoint (stricter for `declare_war`, `join_group`).

| Endpoint | Type | Purpose |
|---|---|---|
| `start_session` / `end_session` | RPC | server-timestamped focus, server reward roll (Step 5.5) |
| `sync_pull` / `sync_push` | RPC | delta pull; outbox push of non-economic changes (equip, settings) |
| `purchase` | RPC | spend gold + grant item atomically |
| `apply_layout` | RPC | validate and save building placement |
| `move_island` | Edge | spend Unicorn, new seed, re-place animals |
| `get_content_manifest` | RPC | latest content pack for this client version (Step 5.8) |
| `set_handle` / `find_by_handle` | RPC | identity (Step 7.1); exact match only |
| `friend_request` / `friend_respond` / `friend_remove` / `list_friends` / `block_user` / `report_user` | RPC | Phase 7 |
| `get_island_snapshot` / `list_visitors` | RPC | visits and traces (Steps 7.4, 7.5) |
| `together_create` / `together_join` / `together_start` / `together_leave` | RPC | Step 7.7 |
| `create_group` / `group_invite` / `group_invite_respond` / `join_group_by_code` / `leave_group` / `group_admin` | RPC | Step 8.1 |
| `get_leaderboard` / `get_group_mission` | RPC | Steps 8.4, 8.5 |
| `declare_war` / `list_wars` / `get_war` | Edge / RPC | Phase 9 |
| `register_device` | RPC | push token per device (Phase 6) |
| `export_account` / `delete_account` | Edge | data export, in-app account deletion |

#### Step 5.3 — RemotePort adapter
Implements the contract above (`SupabaseRemote`) plus an in-memory `FakeRemote` with the same behavior (including idempotency and error codes) for tests and offline development. All retries go through one helper that reuses the original `requestId`.

#### Step 5.4 — Accounts and authentication
- Sign-in is optional for solo use and required for the Friends and Group tabs.
- Methods:
  - **Email one-time code** (6 digits) rather than a magic link: it works when the email is read on another device and needs no redirect back into the app.
  - **Sign in with Apple** (native sheet on iOS; needed on iOS when other third-party logins are offered) and **Google** (native on Android). On desktop web both run as web OAuth.
- Token storage goes through the platform adapter: browser storage on web, **Keychain / Android Keystore** via a secure-storage plugin on native.
- Profile: handle `name#tag` chosen after first sign-in (Step 7.1), avatar = one species the user has found.
- **In-app account deletion** (required by Apple for apps with account creation): offers a backup export first, then deletes all server data.
- Privacy notice; update README and status docs that currently say nothing leaves the device.

#### Step 5.5 — Server-authoritative economy (when signed in)
- `start_session()` → server stores start time, returns `sessionId`. At most one running session per user across all devices.
- `end_session(sessionId, clientEndedAt)` → server clamps `clientEndedAt` into `[serverStart, now]`, applies the existing cap, rolls tier and species with the shared reward rule and a server-side random seed, places the animal with the shared placement rule, writes session + animal atomically, returns the reward.
- **Offline at end** (start was verified): the Break screen shows the reward card as "Revealing when you're back online…" and retries with the same `requestId`.
- **Offline at start:** the session runs and is rewarded locally with `verified=false` (on the island, in stats, excluded from score and war).
- Expiry, purchases, building layout, equip and island move run the shared rules server-side. Expiry is settled lazily at the start of every relevant call and by an hourly job.
- Spending gold and moving the island require connectivity ("Connect to use the shop").
- The server's knowledge of running sessions is reused to suppress push notifications during Focus (Step 6.6).

#### Step 5.6 — Sync engine
- Pull (`sync_pull(sinceSeq)`) on app start, on **app resume** (lifecycle event from the platform adapter), on returning to Home, and every 5 min while idle. **Never during Focus** (store guard).
- Push non-economic changes through an outbox with stable `requestId`s.
- The local store remains the cache: the app opens instantly and focusing works offline.

#### Step 5.7 — First sign-in migration
- Empty account → upload the local save (sessions, animals, gold, cosmetics, buildings, seed). Local animals are trusted once (`verified=true`; they expire within 7 days anyway; ADR).
- Account already has data (second device) → "Use the data from your account (recommended)" or "Replace account data with this device" (typed confirmation). Auto-export a local backup first (Step 0.2).

#### Step 5.8 — Remote content delivery (§2.13)
- `npm run content:publish` uploads a built pack (JSON + atlas) to storage/CDN and inserts a `content_releases` row with `content_version`, checksum and `min_client_version`.
- `get_content_manifest` returns the newest pack this client version can use. The client checks on app start/resume (not during Focus), downloads in the background, verifies the checksum, stores it in `contentPacks`, and activates it on the next return to Home.
- The server validates purchases against the same catalog version; buying an item unknown to the server fails with `item_unavailable`.
- Rollback = publish the previous pack under a higher version. Owned items always stay renderable (models are kept in every later pack).

---

### Phase 6 — Mobile apps (M7, F9)

Moved **before** the social features: invite links, push notifications and native sign-in shape how groups and war feel, so they are built on a working mobile shell instead of being retrofitted.

#### Step 6.1 — Capacitor shell
iOS and Android projects wrapping the same web build; bundle ids, icons, splash, status bar style; CI produces signed debug builds for both. Check the current Capacitor major version and plugin compatibility in its docs.

#### Step 6.2 — Native platform adapters
Implement the native side of every existing adapter, plus the new ones:

| Adapter | Web | iOS / Android |
|---|---|---|
| Storage | IndexedDB | **SQLite-backed** adapter. WebView storage can be cleared by the OS under storage pressure; the local save must be durable. Same schema and migrations as web |
| Keep awake / fullscreen | existing | native keep-awake; hide status bar / immersive mode during Focus |
| Sound | synthesized chime | synthesized chime in foreground; notification sound when backgrounded |
| Vibration | existing | haptics (light on reveal, medium on war result) |
| Secure storage (new) | browser storage | Keychain / Keystore |
| Lifecycle (new) | `visibilitychange` | app pause / resume |
| Local notifications (new) | — | scheduled focus-end and break-end notifications |
| Push (new) | — (Inbox only) | APNs / FCM registration, `register_device` |
| Deep links (new) | URL routing | universal links (iOS), app links (Android) |
| Live progress (new) | — | iOS Live Activity, Android ongoing notification (Step 6.8) |

#### Step 6.3 — Timer in the background
- On Focus start schedule a local notification for the planned end; on break start schedule one for the break end. Cancel or reschedule on stop, end or settings change.
- The timer is already timestamp-based; on resume, recompute state from timestamps.
- This end notification is the only thing allowed to reach the user during Focus.

#### Step 6.4 — Touch, layout, performance
- Safe areas (notch, home indicator); portrait first, tablet landscape supported.
- Tab bar at the bottom within thumb reach; touch targets ≥ 44 pt.
- Gestures: one finger rotates the island, pinch zooms; build mode drags the ghost with the finger, rotation via button; poke = tap.
- Hover behaviors (prefetch, tooltips) get touch equivalents (prefetch on press, long-press for info).
- Cap device pixel ratio at 2, reduce shadows on mobile, keep the Focus low-power mode.

#### Step 6.5 — Deep links
- Links: group invite `https://<domain>/join/<CODE>`, friend add `https://<domain>/add/<name>-<tag>` (URL-encoded; Hangul names work), war replay `https://<domain>/war/<id>`.
- Native: universal links / app links open the app directly. Web fallback page: opens the web app, or offers the store badges on phones without the app.
- Replaces the `#/join/CODE` hash route; the web app handles the same paths.

#### Step 6.6 — Push notifications
- `devices` table: user, platform, push token, app version, locale, last seen.
- Server sends push for: friend request, group invite, focus-together invite, war report (defender), weekly result, group mission milestone, a member joined your group.
- **Suppressed while the user has a running server session**; the event waits in the Inbox and is shown on Break/Home (focus rule).
- Settings: per-category toggles; ask for permission only at the first social action (first friend request or group join), with a one-line explanation, never at first launch.

#### Step 6.7 — Store readiness
- Privacy details (App Store privacy labels, Play data safety form), iOS privacy manifest, no tracking.
- Age rating questionnaire (mild cartoon battles).
- In-app account deletion (Step 5.4), user-generated content moderation (Step 7.2).
- Review notes with a demo account that is already in a group.
- Gold is earned only. If real-money purchases are ever added, they must use the stores' in-app purchase systems (not planned).

#### Step 6.8 — Lock-screen progress (required, owner decision rev 3)
- iOS: Live Activity (lock screen and Dynamic Island). Android: ongoing notification with a system chronometer.
- Shows the phase and time: Focus countdown → at the planned end "Time's up · open Sift to end focus" (show overtime counting up if the platform can render it from a start date without app updates; verify) → Break countdown → removed when the break ends or the session is stopped.
- Driven by dates, not by app updates, so it stays correct while the app is suspended. Update it on every phase change from the store through the `liveProgress` adapter.
- Passive only (§2.14): no buttons that end or stop focus, tap opens the app; no sound beyond the existing end notification.
- Settings toggle `liveProgress` (default on). Web: no-op adapter.
- Needs a native plugin (community or custom Swift/Kotlin). Verify current platform capabilities and limits in the official docs and record them in an ADR before starting.

---

### Phase 7 — Identity, friends, visits, presence, focus together (F7)

#### Step 7.1 — Handle `name#tag` (shared rule `shared/rules/handle.ts`, ADR)
- **Name:** 2–12 characters after Unicode NFC normalization, counted in code points (one Hangul syllable = 1).
  - Allowed: complete Hangul syllables (U+AC00–U+D7A3), Latin letters A–Z/a–z, digits 0–9. Mixed scripts allowed (`민지Kim`).
  - Rejected: spaces, symbols, emoji, standalone Hangul jamo (`ㄱ`, `ㅏ`), digits only, reserved words (`sift`, `admin`, `운영자`, …), profanity (Korean and English lists, server side).
- **Uniqueness key:** `handle_key` = NFC + lowercase for Latin. `Mina` and `mina` share a key; display keeps the chosen case.
- **Tag:** 4 digits `0001`–`9999`, assigned randomly by the server so (`handle_key`, `tag`) is unique. Users cannot choose the tag.
- **Display:** `민지#4821` everywhere; in lists the name is prominent and `#4821` smaller and muted.
- **Change:** name change allowed once per `balance.identity.nameChangeCooldownDays` (30). The tag is kept if free under the new name, otherwise re-rolled. Relations use user ids, so friendships and groups survive changes.
- **Onboarding:** after first sign-in a "Choose your name" screen is required before Friends or Group can be used; it shows the assigned handle with a copy button.
- **Tests:** Hangul, Latin, mixed accepted; jamo, emoji, spaces, digits-only rejected; decomposed Hangul input normalizes to the same key as composed; case-insensitive Latin; length bounds with Hangul; formatting.

#### Step 7.2 — Moderation, block and report (required for app stores)
- Server-side name filter for handles and group names (Korean and English lists, no URLs).
- **Report** a user from the friend list, group member list or visit banner (reason + optional note) → `reports`.
- **Block:** removes any friendship, rejects future requests and group invites from that user, hides presence both ways, denies island visits both ways. Blocking does not remove anyone from a group; group owners handle that (Step 8.1).

#### Step 7.3 — Friends
- **Add:** type an exact handle `name#tag` (no fuzzy search, no user directory, to prevent scraping), or open a friend link `https://<domain>/add/<name>-<tag>` (Step 6.5; URL-encoded, Hangul supported), or share your own handle/link through the share sheet.
- Request → pending → accept/decline. Outgoing requests can be cancelled. Duplicate requests in both directions auto-accept.
- Limits: `balance.social.maxFriends` (100); request rate limit.
- **Friends tab layout:**
  - Header: your handle with copy/share, "Add friend" button.
  - Requests section (incoming with Accept/Decline, outgoing with Cancel) with a count.
  - Friend list: avatar sprite, handle, presence ("Focusing now"), actions **Visit**, **Focus together**, and a menu with Remove, Block, Report.
  - Recent visitors (Step 7.5).
- Friends never see each other's scores or wars; those live in the Group tab.

#### Step 7.4 — Island snapshot and visit mode
- `get_island_snapshot(userId)` is allowed when the two users are friends **or** members of the same group, and neither has blocked the other. It returns the data for `IslandModel`: seed, level, theme, active animals with equipped skins, placed buildings, gold pile level, champion flag, handle. Score is included only for same-group members.
- Visit mode: the scene swaps to the other island with a short cloud transition. Banner "민지#4821's island" (+ score inside a group), Back button. Rotation/zoom/poke allowed (poke is local only). No shop, no build, no gold HUD. Time of day follows the viewer.
- Cache snapshots for 60 s; prefetch on hover (web) or press (touch).

#### Step 7.5 — Visit traces (mechanism only; design decided later)
- Every visit records a row in `visits` (host, visitor, time, `trace_kind`, `trace_payload`), at most one per visitor per host per day; retention `balance.social.visitRetentionDays` (30).
- `trace_kind` is a data-driven string; today only `'basic'` with an empty payload. Future kinds (signpost, emoji, small gift) add values and payloads without a schema change.
- Host side: "Recent visitors" list in the Friends tab (handle, time). On the island, a **placeholder** prop is rendered from the visit count behind flag `features.visitTraceProp` (off by default) so the rendering hook exists when the design is decided.
- No notices or push for visits until the design is decided.

#### Step 7.6 — Presence
- "Focusing now" is derived on the server from running sessions (Step 5.5); live updates through a realtime channel (e.g. Supabase Realtime) scoped to friends and group members.
- Shown in the friend list, the group member list and the ranking, and on Home as a small static avatar stack under the start button ("3 friends focusing"), which invites the user to start too.
- Settings: "Show when I'm focusing" (`showFocusPresence`, default on). When off, others see nothing.
- Presence never appears on the Focus screen except inside a focus-together room (Step 7.7).

#### Step 7.7 — Focus together
- Start from a friend's row, the Home avatar stack, or the group member list: "Focus together" creates a **room** with the host's focus length and invites selected friends/group members (push if they are not focusing, otherwise Inbox).
- Lobby up to `balance.together.lobbyMinutes` (5): participants see who joined; the host starts; everyone's session starts with the **same server start time** (`start_session(roomId)`). Late join allowed within `lateJoinMinutes` (2), with their own remaining time.
- **During Focus** (§2.14 exception): one static line under the timer, e.g. `with 민지 · 재현` and a static dot per participant (filled = still focusing, hollow = stopped). Updates silently: no animation, no sound, no toast. Hidden if the user turns it off in Settings.
- Rewards are individual and unchanged (`balance.together.rewardBonus` = none). Overtime and stopping are individual.
- **Break:** a "Together" strip shows each participant's result and their revealed animal sprite.
- Group missions count together sessions normally (`balance.together.missionMultiplier` = 1.0, tunable).
- Server: `together_rooms`, `together_participants`; rooms expire if never started.
- **Tests:** shared start time; late join window; leaving the lobby; one participant offline; rewards unaffected.

---

### Phase 8 — Groups: membership, ranking, missions, weekly reward (F11)

#### Step 8.1 — Group membership (ADR)
- **Create:** name (filtered) + timezone (defaults to creator's). Creator becomes owner. One group per user in v2.
- **Invite:** from the friend list (in-app invite, accepted in the Group tab or via Inbox/push) or with an 8-character code / link `https://<domain>/join/<CODE>` that the owner can regenerate or disable. Size 2–`maxGroupSize` (10).
- **Leave:** any member at any time (confirm dialog explains weekly reward eligibility). An owner must transfer ownership first, unless they are the last member, which disbands the group.
- **Owner powers:** rename, remove member, transfer ownership, regenerate/disable code, toggle war on/off, disband.
- **Anti-farming:** after leaving a group, a user cannot join any group for `groupRejoinCooldownHours` (24). Weekly reward eligibility requires membership for the whole week (Step 8.6).
- **Tests:** invite accept/decline; joining while already in a group fails; ownership transfer; disband; cooldown.

#### Step 8.2 — Group tab
- No group: Create, Join with code, pending invites.
- In a group: header (name, member count, Invite, countdown to weekly settlement in server time) and sub-tabs **Ranking | Missions | Wars | Members**.
- Members: handles, roles, presence, Visit, owner actions, Report, Leave group.

#### Step 8.3 — Scoring (shared rule, owner decision rev 2)
```ts
animalPoints(a)  = cfg.tierPoints[a.tierRank] + (cfg.speciesBonus[a.speciesId] ?? 0)

activePoints     = Σ animalPoints(a)                       // status 'active' && verified
warLossPoints    = Σ cfg.vanishedWeight * animalPoints(a)  // status 'vanished' && endReason 'war'
                                                            // && verified && endedAt in current ranking week
islandScore      = activePoints + warLossPoints
```
- Based on the animals the user **currently has**; departed (`departed`) and spent Unicorns (`spent`) count 0.
- Animals lost in war count **50%** until the end of the ranking week in which they vanished (`vanishedWindow = 'rankingWeek'`; `'untilNaturalExpiry'` available in config).
- Gold and focus time never affect the score.
- Fractional scores: compute and compare exactly, display at most one decimal.
- **Tests:** active only; departed/spent excluded; vanished at 50% inside the week, 0 after the boundary (group timezone); both window modes; unverified excluded.

#### Step 8.4 — Ranking sub-tab
- Rows: rank, avatar, handle, **score**, **this week's focus time** (information only), presence, crown for last week's champion, your row highlighted.
- Tap a score → breakdown: active animals by tier, "Lost in battle this week (50%)".
- Row actions: **Visit**, **Attack** (Phase 9; only when war is enabled).

#### Step 8.5 — Group missions (shared rule `missions.ts`)
- One cooperative mission per group per ranking week; type `focusMinutes` now, data-driven so `sessions`, `togetherSessions`, `speciesFound` can be added later.
- **Target scales with group size** (`n` = members at week start, frozen for the week):
  `targetMinutes = round(perMemberMinutes × n × sizeFactor[n])`, defaults `perMemberMinutes = 300` and `sizeFactor` from the table in §8 (larger groups get a slightly lower per-person share because not everyone is active every week).
- **Progress:** sum of verified, completed session minutes (same counting rules as Step 1.2) of members during the week. Contributions stay counted if a member later leaves; members who join mid-week contribute but do not raise the target.
- **Milestones** at 50% / 100% / 150% of the target. When a milestone is reached, every member who contributed at least `minContributionMinutes` (25) receives the milestone's gold (`milestoneGold` 10 / 30 / 30) immediately via ledger and an Inbox notice (shown after Focus).
- Updated in the same server transaction as `end_session`; each milestone is granted exactly once (unique key).
- **Missions sub-tab:** progress bar with milestone markers, minutes done vs. target, days left, reward per milestone and claimed state, contribution list (handle, minutes).
- **Tests:** target table for n = 2…10; milestone crossing exactly once (including two milestones in one session); leaving member; mid-week joiner; contribution threshold.

#### Step 8.6 — Weekly settlement (server job)
Scheduled every 15 min; for each group whose local week boundary (Monday 00:00 in the group timezone) has passed and is not settled:
1. Settle expirations for all members.
2. Compute `islandScore` at the boundary for each member; store in `weekly_results` with the week's focus minutes and `balance_version`.
3. Winner = highest score; ties all win. No winner if the top score is 0 or the group had fewer than `minMembersForReward` (3) members for the whole week. Members who were not in the group for the whole week are not eligible.
4. Credit `weeklyWinnerGold` (50) via ledger; set the Champion Flag on the winner's island for the new week.
5. Close the mission week and create the next one with the new member count.
6. Notices for all members; push per Step 6.6.
- Idempotent (unique `group_id + week_start`). The war-loss score window resets at the same boundary.
- Client: notice card on Home ("You won week 41! +50 gold"); the Champion Flag rises next to the camp with a short fanfare.

---

### Phase 9 — War inside a group (F8)

#### Step 9.1 — Rules and config
```ts
war: {
  lossOdds: { base: 10, byGap: [1, 10, 100, 1000] },  // byGap overrides base^gap if present
  vanishChanceOnFall: 0.25,
  unicornAura: { radius: 2, metric: 'chebyshev', vanishChance: 0.05, appliesTo: 'defender' },
  attackExcludedSpecies: ['unicorn'],                  // owner decision rev 3
  lootBrackets: [ /* see §8, defender gold → gold taken */ ],
  attackerCooldownHours: 24,
  defenderShieldHours: 12,
  newMemberProtectionHours: 48,
  freezeBeforeSettlementMinutes: 60,
  maxRounds: 500,
}
```
- **Only inside a group:** attacker and defender must be members of the same group with war enabled.
- **Duel:** ranks `ra`, `rb`, `gap = |ra - rb|`, `odds = byGap[gap] ?? base^gap`. The higher-ranked animal falls with probability `1 / (odds + 1)`, the lower-ranked with `odds / (odds + 1)`. Same rank: 50/50. Every duel makes exactly one animal fall.
- **Fallen:** removed from the battle (stops rendering after its fall animation). After the battle each fallen animal rolls `vanishChanceOnFall` (25%). Vanished animals leave for good (`status='vanished'`, `endReason='war'`, no gold; 50% in the ranking that week, Step 8.3). Others go home unchanged.
- **Unicorn roles (owner decisions rev 2 and rev 3):**
  - Unicorns **never join an attack**; they stay home and are unaffected by the attacker's battle.
  - Defending Unicorns fight and project the aura: a defending animal within 2 tiles (Chebyshev, 5×5 square) of a defending Unicorn at battle start uses 5% instead of 25%. The Unicorn itself is covered; Unicorns do not stack. Attackers never get the aura.
- **Tiger:** the attack Legendary by design. No special mechanic beyond its rank; it leads the formation (Step 9.2). Unicorn = defense and island moves, Tiger = offense.
- **Victory:** the side with no animals left loses.
- **Armies:** attacker = all active, verified animals except `attackExcludedSpecies`; defender = all active, verified animals. An attack needs at least one eligible attacking animal.

#### Step 9.2 — Formation (shared)
- Defender positions = their island tiles (used for the aura). With Phase 10, these are the user's own arrangement.
- Attacker positions = deterministic landing formation on a strip at the defender island's edge, highest rank in front (Tigers lead).

#### Step 9.3 — Simulation (shared, deterministic)
```ts
simulateBattle(attackers, defenders, seed, cfg) => {
  winner: 'attacker' | 'defender';
  rounds: Array<{ duels: Array<{ a: id; d: id; meet: Vec2; loser: id }> }>;
  fallen: id[]; vanished: id[]; protected: id[];   // protected ⊆ defenders
}
```
1. Compute aura-protected ids from defender start positions and defending Unicorns.
2. Each round: shuffle living attackers with the seeded RNG; each picks the nearest unmatched living defender (ties by id); unpaired animals wait. Resolve duels; the winner's position becomes the meeting point.
3. Repeat until one side is empty (guard `maxRounds`).
4. Roll vanish for every fallen animal (aura-aware).

Tests: determinism; invariants (one fall per duel, exactly one side empty, `vanished ⊆ fallen`, `protected ⊆ defenders`, no Unicorn among attackers); statistics over ≥ 10,000 seeded runs (duel odds, 25% / 5% vanish); aura boundaries (distance 2 protected, 3 not, diagonal 2 protected).

#### Step 9.4 — Gold loot (shared rule `war/loot.ts`, owner decision rev 3)
- When the **attacker wins**, they take gold from the defender according to a **bracket table** on the defender's gold balance at battle time (after settling expirations), not a percentage:
  `loot = min(defenderGold, lootBrackets[highest bracket with minGold ≤ defenderGold].loot)`.
- The table lives in `balance.war.lootBrackets` (defaults in §8) and is the only place to tune it. The server is authoritative, so changing it needs a server deploy, not an app release.
- When the defender wins, no gold moves (§9.2 Q27). Optional weekly cap on gold a defender can lose: `lootLostCapPerWeek` (default `null` = no cap, §9.2 Q28).
- Ledger: defender debit `war_loot_lost`, attacker credit `war_loot`, both `refId = warId`, in the war transaction.
- **Tests:** every bracket boundary (19/20, 49/50, …); balance below loot; zero gold; defender win moves nothing; cap when configured.

#### Step 9.5 — Server: `declare_war(targetId, requestId)`
1. Auth; same group; war enabled; cooldowns, shields, new-member protection, settlement freeze; eligible armies on both sides.
2. Lock both users' animals and wallets; settle expirations for both.
3. Build armies (without attacker Unicorns) and formation, generate a cryptographically random seed, run `simulateBattle`.
4. One transaction: mark vanished animals, transfer loot, insert the `wars` row (seed, `balance_version`, armies, rounds, result, `loot_gold`), notices for both, set cooldown and shield.
5. Push the defender (suppressed while they focus). Return the war record.
The result is decided before any animation; clients only replay it. Retrying with the same `requestId` returns the same war.

#### Step 9.6 — Attacker experience
- Group tab → Ranking → Attack → confirm sheet: your army by tier ("Unicorns stay home to guard your island"), their army by tier, "If you win: +20 gold" (from their bracket), "Your fallen animals have a 25% chance to leave for good. Their animals near a Unicorn are protected (5%).", cooldown note.
- Confirm → `declare_war` → sequence (Skip and 2×):
  1. **Muster:** attacking animals walk to a dock tile at the island edge (Unicorns stay at the camp); a voxel airship descends beside the island.
  2. **Boarding:** animals hop aboard; extras disappear into the hull.
  3. **Voyage:** the ship lifts off; the camera follows through the clouds (~4 s); the defender island grows in view.
  4. **Landing:** attackers hop into formation, Tigers in front. A soft glow marks the defender's protected zone around each Unicorn.
  5. **Battle replay:** per round, paired animals run to the meeting point, bump (squash and stretch, dust burst), the loser tips over, fades and stops rendering. At most ~20 simultaneous duels; whole battle ≤ ~30 s.
  6. **Result:** Victory/Defeat; survivors, fallen (returning home), vanished ("left for good", distinct poof). On victory, two animals carry a loot chest from the defender's coin pile to the ship (the pile visibly shrinks). The ship flies home (short); the chest empties into your coin pile and the HUD counts up.
- Reduced motion: result screen with simple fades.

#### Step 9.7 — Defender experience
- Push (outside Focus) and an Inbox notice on Home/Break: "재현#0712 attacked your island at 14:02. You lost — 2 animals left for good and 20 gold was taken." with **Watch replay** (battle on your own island, including the chest leaving).
- Vanished animals and lost gold are already reflected when the island loads.

#### Step 9.8 — Wars sub-tab
Last 20 wars in the group involving you (opponent, result, losses, loot), each with replay and a share link (Step 6.5).

#### Step 9.9 — Performance
Two islands, an airship and up to 2 × 100 animals. Instancing per (species, skin), reduced shadows for distant objects. Targets: 60 fps on the reference desktop; ≥ 30 fps with no frame over 50 ms on reference mid-range iPhone and Android devices (define them in the ADR). Measure the existing 100-animals target at the same time.

---

### Phase 10 — Arrange animals by drag and drop (F12, later; owner decision rev 3)

Replaces open question Q7 ("no arranging"). Scheduled after war because it makes defense positioning (Unicorn aura) a player choice.

#### Step 10.1 — Arrange mode
- Extends build mode (Step 3.11): Home only, never during Focus or Break.
- Pick up an animal by drag (mouse) or long-press then drag (touch); the ghost snaps to tiles; valid tiles via occupancy (walkable, not water, not camp/reserved, not buildings; sharing a tile follows Step 3.13 limits). Drop to place; the animal hops there.
- Placed animals become `pinned: true`; automatic placement never moves pinned animals (except when a building is placed on them, Step 3.11, which unpins them).
- Island move (Phase 4) re-places everyone and clears pins.

#### Step 10.2 — Sync and authority
- Signed in: `apply_layout` validates animal positions server-side with the same occupancy rule and returns the stored layout.
- Wars use the stored layout at battle time.
- Rate limit layout writes; no layout changes are accepted while a war against the user is being resolved (row lock in Step 9.5).

#### Step 10.3 — Tests
Pinned animals survive new rewards and expirations of others; invalid drops rejected client and server side; island move clears pins; war formation reads pinned positions.

---

## 8. Balance defaults (single source: `shared/balance/balance.ts`)

| Key | Default | Notes |
|---|---|---|
| `economy.animalLifetimeDays` | 7 | F3 |
| `economy.expiryExemptSpecies` | `['unicorn']` | Unicorn is the move currency |
| `economy.goldByTierRank` | `[1, 3, 8, 25]` | Common, Mythic, Epic, Legendary |
| `economy.starterGold` | 30 | one-time |
| `economy.pileThresholds` | `[1, 10, 30, 100, 300, 1000]` | coin pile visual levels |
| `prices.animalSkin` | 25–60 | by family; handcrafted 80 |
| `prices.blockTheme` | 120–200 | |
| `prices.building` | 10–80 | fence 10 … windmill 80 |
| `shop.newBadgeDays` | 14 | |
| `build.minFreeTiles` | 6 | |
| `islandMove.cost` | 1 Unicorn | |
| `islandMove.freePreviews` | 3 | |
| `stats.includeAbandoned` | false | |
| `identity.nameChangeCooldownDays` | 30 | |
| `social.maxFriends` | 100 | |
| `social.visitRetentionDays` | 30 | |
| `social.maxGroupSize` | 10 | |
| `social.groupRejoinCooldownHours` | 24 | |
| `social.minMembersForReward` | 3 | |
| `social.weeklyWinnerGold` | 50 | |
| `scoring.tierPoints` | `[1, 3, 10, 30]` | |
| `scoring.speciesBonus` | `{}` | per-species extra points |
| `scoring.vanishedWeight` | 0.5 | owner decision |
| `scoring.vanishedWindow` | `'rankingWeek'` | or `'untilNaturalExpiry'` |
| `missions.perMemberMinutes` | 300 | 5 h per member per week |
| `missions.sizeFactor` | see table below | |
| `missions.milestones` | `[0.5, 1.0, 1.5]` | of target |
| `missions.milestoneGold` | `[10, 30, 30]` | per contributing member |
| `missions.minContributionMinutes` | 25 | |
| `together.lobbyMinutes` / `lateJoinMinutes` | 5 / 2 | |
| `together.rewardBonus` | none | |
| `together.missionMultiplier` | 1.0 | |
| `war.unicornAura.appliesTo` | `'defender'` | owner decision |
| `war.attackExcludedSpecies` | `['unicorn']` | owner decision |
| `war.lootBrackets` | see table below | owner decision: brackets, not % |
| `war.lootLostCapPerWeek` | `null` | no cap |
| `war.*` (other) | see Step 9.1 | |

**Group mission size factor** (`targetMinutes = 300 × n × factor`):

| Members `n` | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| factor | 1.00 | 0.95 | 0.90 | 0.85 | 0.85 | 0.80 | 0.80 | 0.75 | 0.75 |
| target (h) | 10 | 14.3 | 18 | 21.3 | 25.5 | 28 | 32 | 33.8 | 37.5 |

**War loot brackets** (defender's gold at battle time → gold taken on attacker victory):

| Defender gold from | to | Loot |
|---|---|---|
| 0 | 19 | 0 |
| 20 | 49 | 5 |
| 50 | 99 | 10 |
| 100 | 199 | 20 |
| 200 | 499 | 35 |
| 500 | 999 | 60 |
| 1,000 | ∞ | 100 |

Server-only settings (`app_config` table, not in the balance file): `min_supported_api_version`, rate limits, push on/off per category.

Economy sanity check: with the current odds an animal leaves on average ≈ 2.5 gold (a Unicorn leaves none). At 4 sessions a day that is ≈ 10 gold per day, ≈ 70 per week, plus up to 70 per week from group missions and 50 for a weekly win. A building costs 1–8 days of focus and a theme 2–3 weeks. Loot is at most ~1 day of income for small balances and ~10% for large ones, so it stings without wiping anyone out. Continuous skin and decoration releases (§2.13) are the long-term gold sink.

---

## 9. Decisions and open questions

### 9.1 Resolved by the owner
| # | Decision | Where |
|---|---|---|
| Q7 | Animals can be arranged by drag and drop (later phase) | Phase 10 |
| Q17 | Separate friends (request/accept by `name#tag`, Korean supported) and groups (create/invite/leave); ranking, missions and war only inside a group | §2.12, Phases 7–9 |
| Q18 | Ranking score = animals currently held; war-lost animals count 50% for that ranking week; focus time shown, never ranked | Step 8.3 |
| Q19 | Unicorn aura protects defenders only | Step 9.1 |
| Q21 | Attacker victory takes gold from the defender by a bracket table (not %) | Step 9.4, §8 |
| Q24 | iOS and Android are release targets; DB and API designed for them; mobile shell before social | §2.11, Phases 5–6 |
| Q25 | Unicorns do not join attacks | Step 9.1 |
| — | Tiger is the attack-oriented Legendary; Unicorn is defense and island moves | Step 9.1 |
| — | Skins and decorations are released continuously; content is data with tooling and remote packs | §2.13, Phase 3, Step 5.8 |
| — | Departures have no emotional framing: animals leave gold and disappear | Step 2.3 |
| — | Group missions scale with group size and live in the Group tab | Step 8.5 |
| — | Presence and focus together; lock-screen progress notification (required) | Steps 7.6, 7.7, 6.8 |
| — | Visit traces: mechanism now, design later; memory album not now | Step 7.5, §1 |

Update the corresponding ADRs to `Accepted`.

### 9.2 Still open (defaults applied, ADR status `Proposed`)
| # | Question | Default applied |
|---|---|---|
| Q12 | Starter gold so the shop is usable in week one? | 30 gold once |
| Q13 | Skins per species or per individual animal? | Per species |
| Q14 | Does the Tiger expire like other animals? | Yes, only Unicorn is exempt |
| Q15 | On island move, keep buildings where possible or return them to inventory? | Return to inventory |
| Q16 | Animals earned while offline at focus start excluded from score and war? | Excluded (`verified=false`) |
| Q20 | War odds: 10× per tier step, or flat 1:10 for any difference until tuned? | 10× per step |
| Q22 | Can the group owner turn war off? | Yes, per group |
| Q23 | Can gold buy a Unicorn? | No |
| Q26 | War-loss 50% window: end of that ranking week, or until the animal's natural expiry? | End of the ranking week |
| Q27 | Does a defender who wins take gold from the attacker? | No |
| Q28 | Weekly cap on gold a defender can lose to raids? | No cap |
| Q29 | One group per user, or several groups? | One |
| Q30 | Should focus together give a bonus (reward odds or mission minutes)? | No bonus |
| Q31 | Mission rewards: only gold, or also a group trophy / decoration? | Gold only |
| Q32 | Visit traces: what can a visitor leave (sign, emoji, gift)? | Placeholder only |
| Q33 | Regenerate existing hand-made collection sprites with the sprite generator for a uniform look? | Yes |

---

## 10. Testing and quality per phase

| Phase | Domain/unit | Integration | E2E smoke (extend `npm run e2e`) |
|---|---|---|---|
| 0 | migration v3→v4, occupancy, monotonic level, inbox guard | export/import roundtrip | reload keeps animals in prod build |
| 1 | aggregation incl. DST and midnight | — | open Stats, switch weeks/months |
| 2 | expiry, ledger atomicity | expiry during Focus deferred | fast-forward clock → gold appears on Home |
| 3 | content schema, registry merge, family expansion, spend/grant atomicity, placement validity, A* | `content:validate` and `content:sprites` in CI; equip reflects in scene | buy and place a building |
| 4 | moveIsland effects | reload mid-sequence | move with test unicorn |
| 5 | API types, error mapping | RPCs against local Supabase; RLS denies direct writes; idempotent retries; `client_outdated`; delta sync; content pack download and checksum | sign in, focus, reward roundtrip with `FakeRemote` |
| 6 | lifecycle, notification and live-progress scheduling | SQLite adapter passes the storage contract suite | builds on iOS simulator and Android emulator; deep link opens add-friend and join flows; focus-end notification and lock-screen progress |
| 7 | handle validation (Hangul, NFC, case), block rules | friend request flows; snapshot permissions; presence channel; together room start | add friend by `민지#xxxx`, visit, focus together with two accounts |
| 8 | scoring, mission targets and milestones | weekly settlement + mission rollover idempotency; membership cooldowns | create group, invite friend, mission progress after a session |
| 9 | simulation, aura, Unicorns excluded, loot brackets | `declare_war` cooldowns, transaction, retry, loot ledger | attack and watch result with loot |
| 10 | pinning rules | `apply_layout` validation | drag an animal and reload |

Use a controllable clock (inject `now`) for all time-based rules so tests never wait. Storage adapters share one contract test suite that every implementation must pass.

---

## 11. Documentation updates

- `ARCHITECTURE.md`: milestones in build order **M8 Stats & tabs, M9 Economy, M10 Content pipeline & cosmetics, M11 Island move, M12 Backend & API, M7 Mobile apps, M13 Friends & presence, M14 Groups & missions, M15 War, M16 Arrange animals** (M7 keeps its number, moves after M12); add `content/`, `tools/`, the `shared/` layer, the remote adapter and native adapters; fix drift listed in status 6.5 (20 animals, drei, CSS Modules or Tailwind).
- `server/API.md` (new): every endpoint, request/response types, error codes, versioning and idempotency rules.
- `docs/CONTENT.md` (new): authoring paths, palette template, presets, budgets, release process.
- `DESIGN.md`: tab bar (4 tabs), Stats views, HUD counters, shop with featured/new/limited, build and arrange modes, Friends tab, handle display, Group tab sub-tabs, missions, score breakdown, visit banner, focus-together line, war screens, mobile safe areas and touch targets; fix `7 / 20`.
- `DECISIONS.md`: ADR-028 onward as marked in this document; a note at the top mapping old tier names to current ranks.
- `PROJECT_STATUS.md`: refresh after each phase.
