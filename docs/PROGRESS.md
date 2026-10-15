# Sift v2 — Build progress

> Maintained by the coding agent during the build loop (`docs/LOOP.md`). The Stop hook reads this file.
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked, needs owner
> Step lines must keep the exact format `- [ ] X.Y Title`. Put notes on indented lines below a step.


## Phase 0 — Foundations

- [x] 0.1 Developer switches can never reach users
  - `resolveRuntimeConfig(file, import.meta.env.DEV)` gates both switches; unit-tested. Accept verified: prod build with both `true` → e2e animal survives reload.
- [x] 0.2 Export / import backup
  - `domain/backup.ts` + generic `exportAll`/`importAll` on both adapters, `FilesAdapter`, Settings → Data. E2E: export → new browser context → import → re-export identical.
- [x] 0.3 Schema v4 migration (§4.1)
  - Dexie v4 + pure `db/migrations.ts` (also used by memory adapter and backup import). v3 fixture DB test: animals active/verified, other values unchanged.
- [x] 0.4 Tier rank everywhere (§2.8)
  - Grep for tier-name comparisons in logic is empty except the frozen Dexie v2/v3 upgrades. Reward/catalog tests moved to the rank API with identical assertions; mapping tests added.
- [x] 0.5 Shared module + seeded RNG + balance config (§2.6, §2.7)
  - `shared/{rng,balance,rules}`; domain binds generic rules to the catalog/terrain. Existing tests untouched and green (the guidance's "329" is now 354 + 11 new shared tests). ADR-030, ADR-031.
- [x] 0.6 Monotonic island level (§2.2)
  - `domain/island/level.ts` (`islandLevel`, `pickNewAnimalTile`); `selectIslandCount` → `selectIslandLevel`; only active animals render/occupy. Tests: departures keep terrain identical; all-active saves unchanged. ADR-032.
- [x] 0.7 Occupancy grid + save repair (§2.5)
  - `domain/island/occupancy.ts`; coin pile reserve (-2,1); repair on every load, persisted via `Commit.animals`. Tests: grid flags, pile tile dry/flat on 300 seeds, overlapping fixture repaired, idempotent (domain + store). ADR-033.
- [x] 0.8 `IslandModel` + `<IslandScene model mode>` (§2.4)
  - Screenshot harness (seeded Math.random, paused clock, imported fixture) vs the pre-refactor build: 6 states pixel-identical within run-to-run noise; Math.random call counts identical. `?twoIslands=99` dev view renders two independent islands, no errors; absent from the production bundle. E2E 18/18. ADR-034.
- [x] 0.9 Inbox infrastructure (§2.9)
  - `domain/inbox`, store `inbox` + guard, `NoticeCard` (DESIGN.md 7.2a). Tests: queued during Focus → shown after; dismiss ignored during Focus; reload into Focus; persistence. E2E 21/21 (×3). ADR-035. **Phase 0 complete; awaiting owner gate.**

## Phase 1 — Tabs and Stats (F1, F2)

- [x] 1.1 App shell with tabs
  - Feature flags (`features.*`, all off; `VITE_FEATURES` for test builds), `activeTab` + `setTab`, `TabBar`, `BreakPill`, `TabPage`. E2E (built with `stats` on): canvas element kept, zero WebGL draws on Stats, Space inert there, bar hidden on Focus, pill returns to Break. ADR-036.
- [x] 1.2 Stats aggregation (domain)
  - `domain/stats/days.ts` + 15 tests (midnight, DST March/October Zurich, empty/current/past/future month, Mon vs Sun week, real minutes not the cap). No new dependency. ADR-037 (Proposed).
- [x] 1.3 Stats tab: Overview
  - `screens/stats/{StatsScreen,Overview}.tsx`, `Stats.module.css`; duration/date strings + tests. E2E: average shown, → disabled on this month, ← / → navigate. Screenshots at 1280 and 390 with 6 weeks of sessions.
- [x] 1.4 Stats tab: Week
  - `WeekView` + shared `Nav`; week kept as "weeks back" so a week-start change keeps the view. Day buttons set the selected day; the sheet itself lands in 1.6. E2E: 7 day buttons, no future weeks, ← / →. 33/33 e2e (×2).
- [x] 1.5 Stats tab: Month calendar
  - `MonthCalendar` + pure `heatLevel` (tested); compact `1h38` time so cells fit 390px. E2E: one button per day of the month + 7 week days. 33/33 e2e (×2).
- [ ] 1.6 Day detail
- [ ] 1.7 Settings

## Phase 2 — Gold economy (F3)

- [ ] 2.1 Ledger and wallet (domain + store)
- [ ] 2.2 Expiry engine (shared rule)
- [ ] 2.3 Departure presentation
- [ ] 2.4 Coin pile prop
- [ ] 2.5 HUD counters
- [ ] 2.6 Collection and poke updates

## Phase 3 — Content pipeline, cosmetics, buildings, shop (F10, F4)

- [ ] 3.0 Palette keys in voxel models (prerequisite)
- [ ] 3.1 Content format, registry and packs
- [ ] 3.2 Behavior presets
- [ ] 3.3 Authoring paths
- [ ] 3.4 Content Studio (development builds only)
- [ ] 3.5 Sprite generation, validation, release process
- [ ] 3.6 Initial content set
- [ ] 3.7 Inventory and equip (domain + store)
- [ ] 3.8 Rendering skins and themes
- [ ] 3.9 Shop screen (built for continuous releases)
- [ ] 3.10 Collection: choose skins and island theme
- [ ] 3.11 Build mode (placing buildings)
- [ ] 3.12 Pathfinding for walking animals
- [ ] 3.13 Animal placement with buildings

## Phase 4 — Island move with a Unicorn (F5)

- [ ] 4.1 Domain
- [ ] 4.2 Confirm UI
- [ ] 4.3 Move sequence (world)

## Phase 5 — Backend, API, accounts, sync (F6)

- [ ] 5.1 Backend choice (ADR)
- [ ] 5.2 API contract (ADR)
- [ ] 5.3 RemotePort adapter
- [ ] 5.4 Accounts and authentication
- [ ] 5.5 Server-authoritative economy (when signed in)
- [ ] 5.6 Sync engine
- [ ] 5.7 First sign-in migration
- [ ] 5.8 Remote content delivery (§2.13)

## Phase 6 — Mobile apps (M7, F9)

- [ ] 6.1 Capacitor shell
- [ ] 6.2 Native platform adapters
- [ ] 6.3 Timer in the background
- [ ] 6.4 Touch, layout, performance
- [ ] 6.5 Deep links
- [ ] 6.6 Push notifications
- [ ] 6.7 Store readiness
- [ ] 6.8 Lock-screen progress (required, owner decision rev 3)

## Phase 7 — Identity, friends, visits, presence, focus together (F7)

- [ ] 7.1 Handle `name#tag` (shared rule `shared/rules/handle.ts`, ADR)
- [ ] 7.2 Moderation, block and report (required for app stores)
- [ ] 7.3 Friends
- [ ] 7.4 Island snapshot and visit mode
- [ ] 7.5 Visit traces (mechanism only; design decided later)
- [ ] 7.6 Presence
- [ ] 7.7 Focus together

## Phase 8 — Groups: membership, ranking, missions, weekly reward (F11)

- [ ] 8.1 Group membership (ADR)
- [ ] 8.2 Group tab
- [ ] 8.3 Scoring (shared rule, owner decision rev 2)
- [ ] 8.4 Ranking sub-tab
- [ ] 8.5 Group missions (shared rule `missions.ts`)
- [ ] 8.6 Weekly settlement (server job)

## Phase 9 — War inside a group (F8)

- [ ] 9.1 Rules and config
- [ ] 9.2 Formation (shared)
- [ ] 9.3 Simulation (shared, deterministic)
- [ ] 9.4 Gold loot (shared rule `war/loot.ts`, owner decision rev 3)
- [ ] 9.5 Server: `declare_war(targetId, requestId)`
- [ ] 9.6 Attacker experience
- [ ] 9.7 Defender experience
- [ ] 9.8 Wars sub-tab
- [ ] 9.9 Performance

## Phase 10 — Arrange animals by drag and drop (F12, later; owner decision rev 3)

- [ ] 10.1 Arrange mode
- [ ] 10.2 Sync and authority
- [ ] 10.3 Tests

## Owner review queue

> Things the agent could not verify automatically (visual checks, feel, balance). The owner reviews them at each phase gate.

- 1.5 · Heatmap steps are greys (hairline → mute-soft → body-mid → primary) at 1 / 30 / 60 / 120 min; no new accent. Check they read as "more focus" and the thresholds feel right.
- 1.3 · Stats Overview look (figures row, day strip). Days are bucketed in the device's time zone.
- 1.1 · Tab bar look and the `island` tab icon (cabin on a block). Turn on with `features.stats: true` locally. Home/Break panels move up 64px while the bar shows; on phones the Break panel now covers more of the island (camera insets unchanged).
- 1.1 · Feature flags: Phase 1 ships only when you set `features.stats: true` in `config/app.yaml` (the agent never turns flags on).

- 0.2 · Settings → Data section and import confirmation card: layout and copy.
- 0.9 · Notice card look (top center, OK button). On desktop it covers the back of the island; the camera does not avoid it. Copy for non-departure kinds is a neutral placeholder until their phases.
- 0.8 · Open `npm run dev` with `?twoIslands` once: two islands side by side (camera fit, clouds cover both). Single-island parity was verified automatically.
- 0.7 · Coin pile tile at (-2,1) (beside the cabin, camera side): confirm the spot before the pile prop is built (Step 2.4). Night sleeping arrangement shifts slightly because that tile is skipped.

## Decisions taken by the agent

> Defaults applied where guidance was silent. One line each: step, decision, reason.

- 1.5 · Stats order: month selector → Overview → Month calendar → Week (own navigation). Calendar cells also open the Day detail. · Keeps the calendar next to the month selector it follows.
- 1.5 · Heatmap thresholds are absolute minutes (`config.ui.heatMinutes`, client-only), not relative to the month's best day. · A day's color means the same in every month.
- 1.2 · No date library: `Intl.DateTimeFormat` for epoch → local date, UTC arithmetic on `YYYY-MM-DD` strings for the rest. · The guidance's "e.g. date-fns + tz" is a suggestion; the platform covers the only DST-sensitive step, tested on both Zurich DST weeks.
- 1.2 · Best-day ties keep the earliest day; a future month's average is 0. · Deterministic; avoids division by zero.

- 1.1 · `activeTab` is in memory only ("persisted for the session") — a reload opens on Island. · Simplest; a reload into Focus/Break must land on Island anyway.
- 1.1 · With only the Island tab enabled, no tab bar is drawn. · Production stays unchanged while `features.stats` is off.
- 1.1 · Tab bar hidden on Settings and Collection pages; leaving Island during the reveal ends it. · Those pages have a close button; avoids replaying the reveal chime.
- 1.1 · `npm run e2e` now builds `dist-e2e` itself with `VITE_FEATURES=stats`. · The e2e must exercise flagged features without turning them on in `app.yaml`.

- 0.1 · Guidance says next ADR is ADR-028, but ADR-028/029 already exist in `DECISIONS.md`; new ADRs start at ADR-030. · Avoid duplicate numbers.
- 0.7 · Updated two placement tests that hard-coded two camp tiles to use `CAMP_RESERVED` (now three). · The spec adds a reserved tile; the tests got stricter, not weaker.
- 0.7 · Repair target = nearest free walkable tile by Euclidean distance, ties by x then z. · Deterministic and simplest.
- 0.5 · `shared/` is a plain top-level folder in the same tsconfig, not a workspace package. · Simplest option; Deno bundling only needs relative imports.
- 0.5 · Placement center bias moved to balance (server places animals in Step 5.5); island shape numbers stay in `config.ts`. · Only outcome-affecting numbers are balance.
- 0.3 · Kept existing field names (`tileX/tileZ`, epoch-ms `acquiredAt`, epoch-ms `endedAt`/`at`) instead of the §2.3 sketch (`tile`, ISO `earnedAt`). · "Adapt names to the existing tree" (§3); avoids rewriting every stored row.
- 0.3 · `equipped` is a kv singleton row, not its own table. · It is a singleton like settings and world.
- 0.3 · `tier` (name) is still stored next to `tierRank`. · Removing it would rewrite every row; 0.4 moves logic onto the rank.
- 0.2 · Backups carry `schemaVersion`; a backup from a newer schema or format is rejected with "newer version" copy. · Old apps must never write rows they cannot read.
- 0.2 · Developer switches (`resetMapOnStart`, `testMode`) are not re-applied after an import. · An import must restore data exactly.
- 0.1 · Updated the stale e2e collection check (`/ 20` → `/ 50`). · The catalog grew to 50 in guidance_v1; this was not a weakened test.

