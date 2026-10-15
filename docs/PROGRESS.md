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
- [x] 1.6 Day detail
  - `DayDetail` (native `<dialog>`: focus trap, Esc), pure `sessionsOnDay` / `countsInStats` (tested). E2E: today = 1 counted session; sheet shows 3 rows, 2 "Stopped after", 1 reward; Esc closes. 36/36 e2e (×2).
- [x] 1.7 Settings
  - `Segmented` control; STATS group only with `features.stats`. Store test (default Monday, Sunday persists, invalid → Monday); e2e: Sunday reorders the week. E2E 37/37 (×3); flags-off production build checked: no tab bar, no Stats setting. **Phase 1 complete; awaiting owner gate.**

## Phase 2 — Gold economy (F3)

- [x] 2.1 Ledger and wallet (domain + store)
  - Owner approved the Phase 0 and Phase 1 gates by requesting Phase 2. `domain/economy/ledger.ts`, `Commit.ledgerAdd/cosmeticsAdd`, store `gold` + `spendGold`. Tests: sum, typed error, rejected amounts, starter once and only with the flag, short balance and failed write change nothing, Dexie rollback + append-only. ADR-039 (Proposed, Q12).
- [x] 2.2 Expiry engine (shared rule)
  - `shared/rules/expiry.ts` + store `applyExpirations` + 60 s check in `App`. Tests: exact 7-day boundary, gold by rank, Unicorn exempt, long absence (one notice), idempotent incl. concurrent calls, deferred during Focus and applied at End focus, Home/abandon transitions, flag off, memory-only animals never stored. ADR-040 (Proposed, Q14).
- [x] 2.3 Departure presentation
  - Pure `pendingDepartures` (tested: leaving set, notice order, held gold, nothing during Focus) + model `leaving`/`departing` (tested) + `DepartureEffects`. Card copy existed since 0.9. Dev server with dummy data: "5 animals left 38 gold.", frames show puffs and coin arcs, no console errors. The HUD count-up lands in 2.5 (uses `heldGold`).
- [x] 2.4 Coin pile prop
  - `goldPileLevel` (tested at every threshold), `pileVoxels` (tested: empty at 0, grows per level, inside its tile, < 200 voxels), `CoinPile` instanced mesh. Dev server with dummy data (level 4): day and night at 1280 and 390, no console errors.
- [x] 2.5 HUD counters
  - `Hud` + `useCountUp`; store `selectShownGold` / `selectActiveUnicorns` (tested: held gold until the notice shows, spent Unicorns not counted). Dev server: 170 → 208 counted up after the notice showed, info bubble opens over the notice card, Esc closes it, no console errors (390 and 1280). Top bar hidden on Focus as before.
- [x] 2.6 Collection and poke updates
  - `strings.poke.timeLeft` (tested), model `expiresAt` (tested, none for Unicorn), canvas-texture label in the bubble, Collection `On island: n` (all-time count test with a departed animal). Dev server: panda "6d left", Unicorn "!". E2E 44/44 (×4) incl. a week fast-forward: notice, count-up, `On island: 0`, persists after reload (rare Unicorn roll handled). **Phase 2 complete; awaiting owner gate.**

## Phase 3 — Content pipeline, cosmetics, buildings, shop (F10, F4)

- [x] 3.0 Palette keys in voxel models (prerequisite)
  - Owner approved the Phase 2 gate by requesting Phase 3. Model palettes are `index → [key, color]` (`defineModel` emits `keys` + default `palette`); `resolveColors` applies a palette override. Terrain/camp colors in `defaultBlocks`. Parity: resolved `[x,y,z,color]` of all 50 models + butterfly parts and terrain colors byte-identical before/after. New test: every model uses known keys, `eye` is `#1E1E1E`.
- [x] 3.1 Content format, registry and packs
  - `content/` JSON + `shared/content/{schema,pack,model,color}.ts` + `domain/content/{registry,baseline}.ts` + `npm run content:build`. Tests: all shipped content accepted, error collection (duplicate id, missing model, missing locale, bad color, unknown release/preset), registry merge (newer wins, older ignored, removed = retired but renderable), availability window + `minClientVersion`, family expansion (50 stable ids, tier prices, overrides). `CATALOG` dumped before/after: identical. E2E 44/44. ADR-041.
- [x] 3.2 Behavior presets
  - `world/presets/{index,parts,particles,lights}`; `buildPack` checks preset ids per kind. Tests: presets.json equals the code's ids, part presets move and stay bounded, particles deterministic/bounded/falling, unknown idle preset rejected. Sparkle/rainbow code moved verbatim from `Animals.tsx`; Camp reuses the shared glow texture.
- [x] 3.3 Authoring paths
  - `tools/vox-import/{vox,import,main}.ts` (reader + writer, no dependency), `tools/content-build/dsl.ts`, `canonicalModel`; baseline loads `content/models/**/*.{ts,json}`. Tests: vox round-trip, z-up conversion, parts + pivots, 4 error messages, DSL primitives/mirror/stairs/erase/parts/errors, and a DSL model JSON byte-equal to the same shape from `.vox`. Template generated by `npm run content:vox -- --template`. No real `.vox` content yet (not available without MagicaVoxel; the path is covered by tests).
- [x] 3.4 Content Studio (development builds only)
  - `screens/studio/{Studio,studioData}`, `/__studio/save` dev plugin, `assemblePack` (lenient in dev), `placementProblem` + footprints in occupancy, renderer support for skins/themes/buildings (needed by the preview; 3.8 wires the player's equipped items). Tests: placement (9 cases incl. rotation, bridge, too_full), save format/path guard, lenient pack. Checked on the dev server with a temporary family: list, preview, live hue slider, save writes the file, `../package.json` refused, no console errors; production bundle has no Studio code. E2E 44/44 (×3) after fixing its midnight flake (clock now starts at 10:00).
- [x] 3.5 Sprite generation, validation, release process
  - `shared/content/{validate,sprites}.ts`, `tools/content-build/validate.ts`, `tools/sprite-gen/main.mjs` + `screens/studio/spriteRenderer.ts`, `ItemSprite`, CI workflow, CONTENT.md release guide. Tests: shipped content valid incl. sprites; footprint mismatch, oversize, too tall, price range, missing price, dates, missing/stale sprite, unknown skin key. Sprite generation is deterministic (same PNG md5 twice). Collection at 1280/390 checked: sprites crisp, silhouettes grey. ADR-042 (Proposed, Q33).
- [x] 3.6 Initial content set
  - `content/{blockThemes,buildings,skinFamilies,skins,releases}/v2-launch.json` + 9 DSL models in `content/models/buildings/`; 316 sprites regenerated; `content:validate` clean. Test: themes, buildings (presets, water, light, flag not sold), 5×50 family skins, handcrafted skins, release and featured ids. Checked in the Studio: windmill sails spin and its placement is refused over the stream, Snow/Cherry particles and roofs, Ghost lavender (first try matched Snowy), no console errors.
- [x] 3.7 Inventory and equip (domain + store)
  - `domain/cosmetics/inventory.ts` + store (`cosmetics`, `equipped`, `placedBuildings`, `buyItem`, `equipSkin`, `equipTheme`), storage load/commit for items, equipped and buildings, `APP_VERSION`. Tests: defaults always owned, instance counts and tray, buy once vs many, refusals (unknown, not for sale, species not found, short gold) change nothing, equip rules, reload keeps equipped, sanitize drops lost items, retired items still equip, dummy items memory-only. Dev server with dummy data + economy + cosmetics: Autumn theme, golden dog, night unicorn, windmill, lantern, tree and flower bed on the island, day and night, no console errors.
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

- 3.6 · Look of the launch content in `/studio`: theme colors (Autumn orange grass, Snow roof, Desert sand, Cherry pink roof), the 9 building models, the 5 family transforms (Golden, Snowy, Shadow, Pastel, Ghost) and the two handcrafted skins. Prices: themes 120–200, buildings 10–80, family skins 25–60 by tier, handcrafted 80.
- 3.5 · Collection and Day detail now show isometric pixel-art sprites (48 px at 2×) instead of the flat front view (Q33 default "yes"). Each sprite fills its frame, so a chick looks as big as a tiger.
- 3.4 · Content Studio (`npm run dev`, open `/studio`): layout and whether the tools cover your release workflow.
- 2.6 · Poke label size (same height as the `!` bubble, small at 0.25× scale) and wording `6d left`. Collection `On island: n` line.
- 2 · Feature flag: Phase 2 ships only when you set `features.economy: true`. To review with sample data also set `testMode.dummyData: true` (dev only): 5 animals leave at start, 2 more within ~3 minutes.
- 2.5 · HUD counters (pill look, coin and horn icons) and the gold info copy. Break has no top bar, so a departure shown on Break counts up out of sight (the Home counter shows the new total).
- 2.4 · Coin pile look (dummy data shows level 4) and its night glow. The 0.7 spot review from Phase 0 is settled by this: it sits left of the cabin, camera side.
- 2.3 · Departure animation (turn on `features.economy` + `testMode.dummyData`; dismiss the first notice): puff and coin sizes, timing, whether it reads as neutral. On desktop the coins land behind the notice card (the pile tile is at the back, next to the cabin).
- 1.6 · Day detail sheet: bottom sheet on phones, centered dialog from 768px. Small models (e.g. Unicorn) look tiny as 48px sprites.
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

- 3.7 · Skins of species never earned are not sold (`species_not_found`), matching "Animal skins (only species you have found)". Earned once is enough, even if the animal left. · Departures must not take skins out of the shop.
- 3.7 · Placed buildings beyond the owned count are ignored on load, not deleted. · Only possible with dev dummy items; no data loss.
- 3.7 · Equipped skins, theme and buildings render only with `features.cosmetics`. · Production stays unchanged while the phase is off.
- 3.7 · A building with a light preset draws its `flame`/`glass` voxels unlit. · The lantern looked dark at night with only the halo.
- 3.6 · Windmill footprint is 2×1 (16 voxels wide) so its sails fit; Desert has no ambient particles; Cherry Blossom uses a new `petals` preset; the Champion Flag waves (`sway`) and is tagged `group-reward`. · Guidance lists the items but not their shapes.
- 3.6 · Family prices by tier: Golden/Shadow 30–60, Snowy 25–55, Pastel 25–50, Ghost 30–60. · Inside 25–60; rarer animals cost more.
- 3.5 · Sprites: 48 px, isometric (same camera as the island), fit to frame (each item fills its sprite, sizes are not to scale), binary alpha; shown at 2× in Collection. · Matches the in-world look; integer scaling stays crisp.
- 3.5 · Staleness is detected by an input hash per sprite, not by pixel comparison. · Rendering differs across GPUs; inputs do not.
- 3.5 · Price ranges: family skins 25–60, handcrafted 60–80 (guidance: "25–60 by family; handcrafted 80"). · Lets a handcrafted skin cost a little less than 80 if needed.
- 3.4 · Studio labels are inline English, not in `ui/strings.ts`. · Developer-only tool, never in production builds.
- 3.4 · Building voxel = 1/8 block (a footprint tile = 8 voxels); anchor tile = the footprint's low-x/low-z corner; 90°/270° swap width and depth. · Fits the §3.5 budget (3×3 → 24 voxels, height ≤ 24 → 3 blocks).
- 3.4 · A footbridge's tiles stay walkable (for A* in 3.12) but animals never live on water tiles. · "No water except bridge tiles" (Step 3.12).
- 3.4 · `minFreeTiles` counts land tiles not covered by other buildings (bridges excepted), after the new footprint. · Literal reading of "keeps at least 6 free tiles for animals".
- 3.4 · E2E fake clock starts at 10:00 local (was: real time). · A run after ~23:20 crossed midnight and split the day-detail sessions.
- 3.3 · Template mapping: color index i = `PALETTE_KEYS[i-1]` (1–36), 255 = pivot; MagicaVoxel +y is the model's front. Objects named `main` or unnamed form the body; any other object/layer name is a part, and each part needs exactly one pivot voxel. · Simplest documented mapping; a part without a pivot cannot animate.
- 3.3 · Model sources live in `content/models/` (DSL `.ts` and `.vox` + converted `.json`, both committed); the ref is the path without extension. · Keeps every content source under `content/`.
- 3.2 · Preset ids are checked per kind (`idle`, `part`, `particles`, `light`); `sparkle` and `rainbow` are both an idle set and a particle effect. Added `petals` for the Cherry Blossom theme. · A theme's `ambient` must be a particle preset, not, say, `spin`.
- 3.2 · `lantern_glow` is a glow sprite, not a three.js point light. · Each real light costs every lit shader; lanterns can be many.
- 3.1 · Species models stay TypeScript builder files in `src/assets/voxels` (model ref `species/<id>`); only the catalog data moved to `content/species/*.json` (one file per tier). · Models are code-authored (Step 3.3 DSL path); moving 50 files gains nothing.
- 3.1 · The app builds its baseline pack at startup from `content/**/*.json` (`import.meta.glob`) instead of loading a generated pack file; `content:build` emits the same pack for publishing. · No committed build output that can drift from the sources.
- 3.1 · `shared/shared.test.ts` allows exactly one package import, `zod`. · The guidance puts zod schemas in `shared/content/schema.ts`.
- 3.1 · Species are not shop items: their schema has no price or availability fields. · Animals are earned, never bought.

- 2.6 · Time left: whole days rounded from 36 h (`7d left` right after earning), hours below, `<1h left` last. · Floor would show `6d` for a brand-new animal.
- 2.6 · `On island: n` shows only with the economy on. · Without departures it always equals the count.
- 2.6 · `world/` may import `ui/strings` (layer rule updated). · UI text lives only in strings.ts and the scene now draws text.
- 2.5 · HUD only on Home's top bar (not Break, Settings, Collection or tab pages). · The guidance places it in "the top bar", which only Home shows over the island.
- 2.5 · Unicorn counter shown even at 0, display only (not a button). · Phase 4 will make it the island-move entry; a count of 0 tells the user the currency exists.
- 2.4 · The pile shows `gold − heldGold` (gold the user has been told about), so it grows when a departure notice shows. · Matches §2.9: visuals play when the notice shows.
- 2.4 · Added a faint night emissive glow on the pile besides sparkles. · With firelight alone it read as dull brown at night.
- 2.3 · Leaving animals keep being drawn while their notice is queued, but their tiles are already free; a new animal could land on one during a break. · Rare and brief; occupancy stays the single truth.
- 2.3 · Animations are driven by the frame clock (`useFrame`), so on a paused tab they play when the island is visible again. · No timers outside the render loop.
- 2.2 · The 60 s expiry check runs on Home and Break (any non-Focus phase), not only idle. · A break should not hold a departure back; Break shows notices anyway.
- 2.2 · Test-mode animals now get `acquiredAt = now` (was 0) and are memory-only like dummy animals. · With 0 they would all depart at once on every start.
- 2.2 · Removed the fake dummy `animals_departed` notice; dummy departures now come from real dummy animals. · The fake one pointed at animals that do not exist.
- 2.1 · `spendGold` grants one `OwnedCosmetic`; buildings and other grant kinds extend it in Phase 3. · Only cosmetics exist as a grantable store today.
- 2.1 · Starter gold is granted on load only while `features.economy` is on, once per save (also existing saves when the flag is first turned on). · Keeps production unchanged while the flag is off.

- Owner request (after 1.7) · Developer switches grouped under `testMode`; `testMode.dummyData` adds in-memory sample data. **Every later step that adds a feature also adds its sample data to `app/devDummy.ts`** (gold/departures in Phase 2, cosmetics in 3, friends in 7, groups/missions in 8, war in 9). · Owner wants to review features with dummy data (ADR-038).

- 1.6 · Day detail is a native `<dialog>` with `showModal()`. · Platform focus trap, Esc and inert background without code.
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

