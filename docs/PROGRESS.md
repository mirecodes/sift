# Sift v2 — Build progress

> Maintained by the coding agent during the build loop (`docs/LOOP.md`). The Stop hook reads this file.
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked, needs owner
> Step lines must keep the exact format `- [ ] X.Y Title`. Put notes on indented lines below a step.


## Phase 0 — Foundations

- [x] 0.1 Developer switches can never reach users
  - `resolveRuntimeConfig(file, import.meta.env.DEV)` gates both switches; unit-tested. Accept verified: prod build with both `true` → e2e animal survives reload.
- [x] 0.2 Export / import backup
  - `domain/backup.ts` + generic `exportAll`/`importAll` on both adapters, `FilesAdapter`, Settings → Data. E2E: export → new browser context → import → re-export identical.
- [ ] 0.3 Schema v4 migration (§4.1)
- [ ] 0.4 Tier rank everywhere (§2.8)
- [ ] 0.5 Shared module + seeded RNG + balance config (§2.6, §2.7)
- [ ] 0.6 Monotonic island level (§2.2)
- [ ] 0.7 Occupancy grid + save repair (§2.5)
- [ ] 0.8 `IslandModel` + `<IslandScene model mode>` (§2.4)
- [ ] 0.9 Inbox infrastructure (§2.9)

## Phase 1 — Tabs and Stats (F1, F2)

- [ ] 1.1 App shell with tabs
- [ ] 1.2 Stats aggregation (domain)
- [ ] 1.3 Stats tab: Overview
- [ ] 1.4 Stats tab: Week
- [ ] 1.5 Stats tab: Month calendar
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

- 0.2 · Settings → Data section and import confirmation card: layout and copy.

## Decisions taken by the agent

> Defaults applied where guidance was silent. One line each: step, decision, reason.

- 0.1 · Guidance says next ADR is ADR-028, but ADR-028/029 already exist in `DECISIONS.md`; new ADRs start at ADR-030. · Avoid duplicate numbers.
- 0.2 · Backups carry `schemaVersion`; a backup from a newer schema or format is rejected with "newer version" copy. · Old apps must never write rows they cannot read.
- 0.2 · Developer switches (`resetMapOnStart`, `testMode`) are not re-applied after an import. · An import must restore data exactly.
- 0.1 · Updated the stale e2e collection check (`/ 20` → `/ 50`). · The catalog grew to 50 in guidance_v1; this was not a weakened test.

