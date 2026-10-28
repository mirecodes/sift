# DECISIONS.md

> **Human reference only.** The rules in effect live in `ARCHITECTURE.md`; the coding agent appends ADRs here but never reads this file as a reference.
> Never delete an ADR; supersede it with a new one. `Accepted` = settled. `Proposed` = default applied, owner should confirm or pick another option.

## Philosophy

1. **Focus is the product; rewards are the garnish.**
2. **Protect the cycle.** Focus → break → focus, no friction.
3. **Honest time.** The timer is always correct; rewards come only from real, completed focus.
4. **Gentle motivation.** Longer focus rewards slightly more; no punishment beyond "no reward".
5. **A world that grows with you.** The island records accumulated effort.
6. **Build once, ship everywhere.** Web first; platform code isolated so mobile is a wrapper.

## ADR Template

```md
## ADR-XXX: Title
- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded by ADR-YYY
- Context / Decision / Consequences
```

## Records

## ADR-001: Styling with CSS Modules
- Date: 2026-09-29 · Status: Proposed
- Decision: CSS Modules + CSS custom properties (over Tailwind) so `tokens.css` stays the single source and DESIGN.md is hard to bypass.
- Consequences: Styles live in `*.module.css` beside components.

## ADR-002: Mobile milestone (M7) deferred
- Date: 2026-09-29 · Status: Proposed
- Decision: Build M1–M6; keep all platform dependencies behind `platform/` adapters so M7 (Capacitor) only adds `native.ts` files. No untested native stubs.
- Consequences: Adapter interfaces are complete; web implementations only.

## ADR-003: Session id on focus phases; overtime/break-over derived
- Date: 2026-09-29 · Status: Accepted
- Decision: Persist only `idle`, `focus`, `break`. `resolvePhase(phase, now)` derives `focusOvertime`/`breakOver`. Focus carries a `sessionId`; ending focus writes session, animal and next phase in one transaction (no double rewards).
- Consequences: ARCHITECTURE.md §7.1 updated.

## ADR-004: Open questions Q1–Q11 use documented assumptions
- Date: 2026-09-29 · Status: Proposed
- Decision: Fish is Common; odds 60/28/10/2 → 50/32/14/4; animals slowed on Focus; no auto-start after break; end-of-focus chime only; no long breaks; automatic placement; animals only; simple stats; local-only, UUID ids, epoch-ms times; Capacitor later (ADR-002).
- Consequences: Supersede to change; numbers live in `src/domain/config.ts`.

## ADR-005: One tile per animal; idle movement stays in the tile
- Date: 2026-09-29 · Status: Proposed
- Decision: Footprint 1×1, models ≤ 6 voxels wide; idle = turn, hop, shuffle. (Alternative: 2×1 large animals and walking, rejected: collisions vs. stored coordinates.)
- Consequences: Placement = pick an empty tile; `footprint` kept for the future.

## ADR-006: Sounds synthesized with Web Audio
- Date: 2026-09-29 · Status: Proposed
- Decision: Sine-partial chimes with exponential decay in `platform/notify/web.ts`; no audio files.
- Consequences: Native can reuse the tones or scheduled notification sounds.

## ADR-007: Reward preview rendering
- Date: 2026-09-29 · Status: Proposed
- Decision: Break card hosts a small transparent `<Canvas>` only while visible; Collection uses 2D pixel sprites (black for silhouettes). Shared scissor canvas rejected as over-complex.
- Consequences: The persistent world canvas is never remounted.

## ADR-008: Terrain blocks are flat-colored cubes
- Date: 2026-09-29 · Status: Proposed
- Decision: Unit cube with top/side vertex colors, one `InstancedMesh` per block type, ±4% deterministic tint per instance. Animals use the voxel format.
- Consequences: ~1,500 instances × 12 triangles for a 100-animal island.

## ADR-009: Custom camera rig; no `@react-three/drei`
- Date: 2026-09-29 · Status: Accepted
- Decision: A `CameraRig` handles fit margin, re-fit on growth, limited azimuth/zoom on Home, 1s Focus pull-back and reduced-motion jump; `OrbitControls` fights all of these.
- Consequences: drei may be added when truly needed.

## ADR-010: "Browser APIs only in `platform/`" means capability APIs
- Date: 2026-09-29 · Status: Accepted
- Decision: Applies to storage, wake lock, fullscreen, audio/notifications, haptics. DOM events, `visibilitychange`, `matchMedia`, `Date.now` are allowed in `ui/`, `screens/`, `world/`. `domain/` stays free of all; time is injected as `now()`.

## ADR-011: Break screen layout and reveal choreography
- Date: 2026-09-29 · Status: Proposed
- Decision: One panel (bottom-center on narrow, right-aligned from 992px). Card fades in (`--motion-slow`), model spins, tier chime plays; after 3.5s or tap/Enter/Space the animal appears on the island. Buttons usable immediately.
- Consequences: Tune with `config.ui.revealMs`; DESIGN.md §7.3 updated.

## ADR-012: Short planned focus never earns a reward alone
- Date: 2026-09-29 · Status: Proposed
- Decision: Keep 5–60 min settings and the 25 min reward rule; the no-reward message explains it. (Alternatives: clamp min to 25; show a hint on Home.)
- Consequences: Alternatives are a one-line change (`config.settings.focusMinutes.min`).

## ADR-013: Island growth shown when returning Home
- Date: 2026-09-29 · Status: Accepted
- Decision: During Break with a reward, size the island from `animals.length - 1` and place the new animal on a tile that exists there; Home sizes from all animals and scales new blocks in over 700ms. Islands are monotone, so stored coordinates stay valid.
- Consequences: Unit test covers monotonicity.

## ADR-014: Animal world scale 0.25x; camera fits island top
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision: `config.render.animalScale` = 0.25 in the world only (models, footprint, reward card unchanged). Camera fits the top plus `undersideFit` (35%) of the underside, 5% margin.
- Consequences: Animals shuffle ±0.35; underside may be cropped. Tune in `config.ts`.

## ADR-015: YAML runtime config with a test mode
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision: `config/app.yaml` (Vite `?raw` + `yaml`, parsed in `src/app/runtimeConfig.ts`). `testMode` adds `speciesCount` random species in memory at startup, never stored; rewards untouched. Enabled by default for now.
- Consequences: Bundled at build time; set `enabled: false` before release.
- Update (same day): `testMode.allSpecies: true` places every catalog species once instead of `speciesCount` random ones. The island needs no special handling: it is sized from the animal count, so it grows to fit them all.

## ADR-016: Night mode, camp (hut + campfire), Focus routines
- Date: 2026-09-30 · Status: Proposed
- Decision (DESIGN.md 15.4): persisted `Settings.theme` (`light`|`dark`) with a top-bar toggle. Campfire on (0,0), hut on (-1,0) facing +z, always present and excluded from animal placement (older saved animals may overlap). Theme at Focus start picks the routine (day: into the hut; night: sleep nearby); theme is locked during Focus. Night Focus overlay 0.6 vs 0.82.
- Consequences: Straight-line paths may clip the hut; pathfinding later. Rejected: hiding hut/pit in light mode, 2-tile hut.

## ADR-017: Circular 7×7 island, half-block terrain levels, hut faces the fire
- Date: 2026-09-30 · Status: Accepted (owner request) · Supersedes the hut placement in ADR-016
- Decision: Minimum side 7; outline uses Euclidean distance (near-circular) instead of a rounded square. Terrain stays level 1–3 but one level is 0.5 block (`config.island.levelHeight`): a full base block plus half-height slabs. Hut on (-2,0) with one empty tile to the fire on (0,0), door facing +x toward the fire.
- Consequences: Blocks get an `h` (height) field; instances scale in y. Stored animal coordinates stay valid (shapes remain monotone), but animals saved on the new hut tile may overlap it.

## ADR-018: Terraced noise terrain with a flat camp
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision: Terrain height = domain-warped fBm + a weak back-high tilt (`config.island.terrain`), blended toward level 2 around the camp by a smoothstep, then terraced with thresholds so a wide middle band is plains and level 3 / level 1 form hills / lowlands. The back-high trend is a tendency, not a rule.
- Consequences: Still a pure per-coordinate function, so islands stay monotone and deterministic. Tests scan many seeds for flat camp surroundings and no cliffs above one level.

## ADR-020: Seed-only winding stream with curved falls and splash
- Date: 2026-09-30 · Status: Accepted (owner request) · Re-adds the stream removed earlier
- Decision (DESIGN.md 15.5): the stream path and its water levels (2 → 1 at a seeded row) depend on the seed only. Terrain around it is clamped (bed cut, banks in [L, L+1]) so tests for flat camp and ≤ 1-level cliffs still hold. The water is one smoothed ribbon mesh (Chaikin corner cutting on the tile path, parabolic falls); splash is stateless instanced cubes. Rejected: water as voxel blocks (blocky bends, no curved falls), terrain-following levels (may give no falls at all), a particle system with per-frame state.
- Consequences: Water tiles are excluded from placement; animals saved earlier may overlap water, and Focus walking paths may cross it (same limits as ADR-016). The stream needs `x ≥ 1`, so the camp flat area is untouched.

## ADR-021: Stream replaces natural terrain; chosen chord, outward rim fall, bank strips
- Date: 2026-09-30 · Status: Accepted (owner request) · Supersedes the path, level and bank rules of ADR-020
- Decision (DESIGN.md 15.5): no bank clamping or raised terrain; stream tiles are natural tiles turned into water (bed cut 0.25, level never rises downstream). The path is the best-scoring wobbling chord (seed only), so it winds, avoids the camp and does not run along the rim; at the rim the last tile falls over the missing neighbor pointing most away from the center. The water is 0.7 wide and everything else in a bed tile is filled with grass strips at the surrounding height.
- Update (same day): the bank is a mesh built in `world/stream/streamMesh.ts` from the smoothed ribbon (marching squares on a 16×16 grid per tile over the distance to the ribbon edge, plus a wall to the bed), so the channel is a smooth curve, not a square notch or voxel steps. The water is opaque and narrows on tight bends, which removed the flicker from the ribbon overlapping itself under transparency. The stream starts at a spring: a round ribbon head with a fountain of white cubes. Rejected: voxel strips (still blocky), a stencil or shader cut-out (the bank would still be a flat block face).
- Consequences: Only the first unbroken run on the island is water, so growth can extend the stream upstream. Candidate search costs ~500 traces per seed, cached per seed. The stream may be nearly straight on the smallest island when the camp leaves little room.

## ADR-022: Click an animal to poke it
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision (DESIGN.md 18): R3F `onClick` on an invisible hit box per animal forces one idle action and shows a voxel `!` bubble for 1.2s. Disabled during Focus routines (immersion, ARCHITECTURE 1.1). Not persisted. Rejected: DOM overlay bubble (needs projecting 3D positions each frame; drei `Html` is not used, ADR-009).
- Consequences: Partially answers Q7 (interaction, not arrangement). Animals are 0.25 block, so the hit box is larger than the model.

## ADR-023: Catalog grows from 20 to 50 species
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision: +16 Common, +8 Epic, +5 Legendary, +1 Mythic (Tiger). Sizes stay within DESIGN.md 16.2 (owner's larger block sizes were dropped) and ADR-005 (1×1 tile). Tiger shares the Unicorn's `sparkle` effect. Tier probabilities are unchanged, so a species' odds within a tier drop (uniform pick).
- Update: the Unicorn's idle is `rainbow` (shared sparkle plus intermittent rainbow bursts); the Tiger keeps plain `sparkle`. Consequences: Collection shows 50 cards and `ANIMALS` reads `n / 50`. Tiger is the white-tiger variant's orange sibling; a white variant is left for later.

## ADR-024: Butterfly is flat, flaps and flies (`flutter` idle)
- Date: 2026-09-30 · Status: Accepted (owner request) · Amends ADR-005 for this species only
- Decision (DESIGN.md 18): the butterfly's world rendering uses a body mesh plus two wing meshes (one mirrored) rotated each frame, and it wanders in the air instead of hopping in its tile. `voxelModels.butterfly` stays one full model in rest pose so sprites and the reward card work unchanged; `butterflyBody` and `butterflyWing` are extra exports used only by the world.
- Consequences: Its flight can leave its own tile (up to 1.2 tiles) and pass over water or the camp. Other species keep the single merged mesh. Rejected: flapping by swapping voxel frames (two or three cached geometries, stiff), a vertex shader (overkill for one species).

## ADR-025: Legendary and Mythic models may be 8 voxels deep
- Date: 2026-09-30 · Status: Accepted (owner request) · Amends the size limit in ADR-005
- Decision: depth limit 8 (width still 6) for Legendary and Mythic; used by Tiger, Bear, Horse and Cow (body +2 voxels). Footprint stays 1×1: at the 0.25x world scale 8 voxels is 1/3 block.
- Consequences: The shuffle range (±0.35) and the hut walk are unchanged; the models.test depth check is per tier.

## ADR-026: Legendary and Mythic names swapped; Legendary is the top tier
- Date: 2026-09-30 · Status: Accepted (owner request) · Amends the tier names used in ADR-023 and ADR-025
- Decision: rank order is now Common < Epic < Mythic < Legendary. The ids, names, colors, reveal chimes, probabilities (Mythic 10% to 14%, Legendary 2% to 4%), height limits (Mythic 7–10, Legendary 10–12) and the 8-voxel depth allowance follow the rank, not the old name: the species that were Mythic (Unicorn, Tiger) are Legendary; those that were Legendary (Horse to Peacock) are Mythic. `TIERS` in `domain/config.ts` lists the ranks lowest to highest. Older ADRs keep their original wording and use the old names.
- Consequences: Stored animals are migrated by Dexie schema version 2 (`tier` legendary to mythic and mythic to legendary). The tier colors moved with the rank (top tier pink, the one below orange), so the UI hierarchy looks the same. Rejected: swapping only the labels in `strings.ts` (ids would contradict the names in code), and keeping colors with the names (the top tier would turn orange).

## ADR-027: Tier order Common, Mythic, Epic, Legendary with blue, pink, orange
- Date: 2026-09-30 · Status: Accepted (owner request) · Amends ADR-026
- Decision: the second tier (the 14 medium animals, Sheep to Koala) is now Mythic and blue (`--color-accent-blue`); the third tier (the 9 large animals, Horse to Peacock) is now Epic and pink; Legendary (Unicorn, Tiger) stays the top tier and turns orange. As in ADR-026 the ids follow the rank, so probabilities (Mythic 28% to 32%, Epic 10% to 14%, Legendary 2% to 4%), height limits (Mythic 5–7, Epic 7–10, Legendary 10–12), the 8-voxel depth allowance (Epic and Legendary) and the reveal chimes stay with the rank. `TIERS` is `common, mythic, epic, legendary`.
- Consequences: Dexie schema version 3 renames stored tiers (epic and mythic swap). Purple is no longer a tier color, and blue is no longer reserved. `#3B89FF` with white text is about 3.4:1 (like the orange and pink fills, below the 4.5:1 goal in DESIGN.md 11; tier names are always shown as text). Earlier ADRs keep their original names.

## ADR-019: `resetMapOnStart` runtime option
- Date: 2026-09-30 · Status: Accepted (owner request)
- Decision: `config/app.yaml` `resetMapOnStart: true` makes every app start roll a new island seed and delete all placed animals (`StorageAdapter.resetWorld`). Sessions, settings and the active phase are kept.
- Consequences: Data loss by design, for testing terrain generation; set `false` before release.

## ADR-028: All documentation lives in `docs/`
- Date: 2026-10-07 · Status: Accepted (owner request)
- Decision: `ARCHITECTURE.md`, `DESIGN.md`, `DECISIONS.md`, `CHANGELOG.md` and `PROJECT_STATUS.md` live in `docs/`; new docs are created there too. `README.md` and `CLAUDE.md` stay at the root (convention, and Claude Code loads `CLAUDE.md` from the root).
- Consequences: `CLAUDE.md` points at `docs/`. Bare file names in code comments and older entries (e.g. `DESIGN.md 16`) still mean the file in `docs/`.

## ADR-029: Guidance-driven work; ARCHITECTURE holds the decisions
- Date: 2026-10-07 · Status: Accepted (owner request)
- Decision: The plan arrives as `docs/guidance_vN.md` and is implemented step by step; all work so far is guidance_v1. `ARCHITECTURE.md` was condensed and now contains every settled decision, so the agent reads only it and `DESIGN.md`. This file becomes a human-only log the agent appends to. `CHANGELOG.md` is grouped by guidance file instead of `[Unreleased]`.
- Consequences: ADR tags in code and docs are pointers for humans; the rule itself must be stated in `ARCHITECTURE.md`.

## ADR-030: One balance config for gameplay numbers
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.6)
- Decision: `shared/balance/balance.ts` exports a deeply frozen `balance` object and a `BALANCE_VERSION` string. It holds every number that changes game outcomes and must match on the server: reward odds and the 25/60 min thresholds, timer limits, the placement center bias; later phases add economy, scoring, missions and war sections (§8). Client-only tunables (render, UI timings, island shape) stay in `src/domain/config.ts`.
- Consequences: The server will import the same file and store `BALANCE_VERSION` with every war and weekly settlement, so replays stay reproducible; every value change must bump the version. Odds became rank-indexed arrays (ADR on tier rank, step 0.4).

## ADR-031: `shared/` layer for deterministic rules
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.7)
- Decision: A top-level `shared/` folder holds rules that must run identically on client and server: the seeded RNG (the existing mulberry32 was moved, not duplicated), tier rank, reward roll, placement, balance. Code there is plain TypeScript: relative imports inside `shared/` only, no browser/Node/Deno globals, no `Math.random()` or `Date.now()`; a test scans the folder to enforce it. Rules are generic (the reward roll takes the species catalog, placement takes candidate tiles and blocked tiles); `src/domain` binds them to the app's data. `src/domain/random.ts` re-exports `shared/rng` so existing imports stay.
- Consequences: Supabase Edge Functions (Deno) can bundle `shared/` unchanged (Phase 5). Island terrain generation is not shared yet; it moves when the server needs to place animals (Step 5.5). Rejected: a separate npm workspace package (more tooling for one folder).

## ADR-032: Island size follows a monotonic island level
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.2)
- Decision: Island generation takes `islandLevel` = the number of animals ever earned on this save, whatever their status (`active`, `departed`, `vanished`, `spent`), instead of the current animal count. The growth function is unchanged; only its input changed. Only `active` animals render and occupy tiles. An island move (F5) keeps the level and changes only the seed.
- Consequences: Departures (F3), war losses (F8) and island moves (F5) never shrink the island or invalidate stored tiles. Saves where every animal is active produce exactly the same island as before. Freed tiles of departed animals are reused by new animals. Rejected: storing the level (it is derived, §4.1).

## ADR-033: One occupancy grid and save repair
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.5, Step 0.7)
- Decision: `getOccupancy` derives per-tile `height, water, campReserved, buildingId, animalIds, walkable, buildable` from seed, island level, animals and buildings. The camp reserve gains a third tile, (-2,1) beside the cabin on the camera side, for the coin pile (F3); it is inside the stream's 1.5-tile camp clearance, so it is flat and dry on every seed (tested for 300 seeds). On load, `repairPlacements` moves every active animal that stands on water, camp, a building or off the island to the nearest free tile (distance, then x, then z) and saves it. Buildings occupy only their anchor tile until footprints arrive (Step 3.1).
- Consequences: Old saves no longer overlap the camp or stream. Animals no longer sleep on the pile tile at night. If an island were completely full, an overlapping animal stays put until tile sharing (Step 3.13). Rejected: putting the pile on (-1,0) (the cabin's walk-in path).

## ADR-034: The renderer draws an `IslandModel`
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.4, Step 0.8)
- Decision: The 3D world renders plain `IslandModel` data built by the pure `buildIslandModel` (domain), not the store. `Scene` keeps the single persistent canvas (lights, camera, clouds, render driver) and takes a list of `{ model, mode }`; `IslandScene` draws one island and holds no global state. Islands are laid out along the camera's screen-right axis and the camera fits the whole row. A dev-only `?twoIslands` view renders a second island from another seed.
- Consequences: Island moves (F5), visits (F7) and battles (F8) only need a second model. Visual parity was verified with a deterministic screenshot harness (seeded `Math.random`, paused clock, fixed backup): Home, Focus and Break in day and night match the previous build pixel for pixel, apart from the harness's own run-to-run noise. The island offset lives on the bob group, so the scene graph (and three.js's `Math.random`-based UUIDs) is unchanged for one island.

## ADR-035: Inbox of deferred notices
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.9, Step 0.9)
- Decision: A persisted queue (`inbox` store, rows `{ id, createdAt, notice }`, `Notice` union from §2.9) collects things to tell the user later. Anything may enqueue at any time. Only on Home (idle) or Break is the oldest notice shown, as a small `NoticeCard` at the top center with an OK button; the store never dequeues while the phase is `focus` (including overtime), and a reload into Focus keeps them hidden. Inbox writes go through the same storage commit transaction as sessions and animals.
- Consequences: Departures (F3), weekly results (F11), war reports (F8) and social events reuse it unchanged and keep the focus rule. Each phase adds its own notice copy; until then a neutral fallback line is shown. Rejected: toasts (they would auto-dismiss and could not wait out a Focus session).

## ADR-036: Tab shell and feature flags
- Date: 2026-10-07 · Status: Accepted (guidance_v2 §2.10, §0.2, Step 1.1)
- Decision: Four top-level tabs (Island, Stats, Friends, Group) in a slim bottom-center bar. Island holds today's Home/Focus/Break and the Settings/Collection pages. A tab other than Island appears only when its feature flag is on; with Island alone there is no bar, so production looks as before until the owner turns a phase on. `activeTab` is kept in memory only (a launch always opens on Island). Focus always runs on Island and hides the bar. Other tabs cover the persistent canvas, which stays mounted and renders no frames; during a break they show a pill with the break timer that returns to Island. Feature flags live under `features` in `config/app.yaml`, are read in every build and are committed `false`; the build variable `VITE_FEATURES` turns them on for test builds (`npm run e2e` builds `dist-e2e` with the finished phases).
- Consequences: Later phases only add a screen and flip a flag. Leaving Island during the reward reveal ends the reveal (the animal joins the island) so it is not replayed on return. The break-end chime plays on every tab. Rejected: persisting the tab in session storage (a reload into Focus or Break should land on Island anyway); flags honored only in dev builds (the owner needs to ship them).

## ADR-037: Stats aggregation rules
- Date: 2026-10-07 · Status: Proposed (guidance_v2 Step 1.2 defaults)
- Decision: Only completed sessions count (`balance.stats.includeAbandoned = false`). Minutes are the real focused time `endedAt − startedAt` (planned + overtime), not the 60-minute reward cap. A session belongs to the local calendar day on which it started (no split at midnight), bucketed in the user's current time zone. Monthly daily average = month total ÷ days elapsed (current month: day 1 through today inclusive; past months: all days). No date library: the only time-zone-sensitive step, epoch → local date, uses `Intl.DateTimeFormat` with the IANA zone; everything else is calendar arithmetic on `YYYY-MM-DD` strings in UTC, which has no DST. Tested across midnight and both Zurich DST weeks.
- Consequences: No new dependency (the guidance suggested date-fns + tz). Changing time zone re-buckets history by the new zone. Collection's all-time "Focus time" still sums the capped effective time, so it can be lower than the Stats total. Rejected: splitting sessions at midnight (a session is one unit of effort).

## ADR-038: Developer switches grouped under `testMode`, plus dummy data
- Date: 2026-10-07 · Status: Accepted (owner request)
- Decision: `config/app.yaml` groups every developer switch under `testMode`: `resetMapOnStart`, `animals` (the former `testMode.enabled/speciesCount/allSpecies`) and the new `dummyData`. `dummyData` adds deterministic sample data built by `app/devDummy.ts` to the store in memory at startup (sessions for Stats, Inbox notices); it is never written to storage or backups and is not re-added after an import. Like the other switches it works only in development builds, and the production bundle drops the generator. Each later phase extends `createDummyData` with its own feature's data.
- Consequences: Features can be reviewed without weeks of real use. Old `app.yaml` files with top-level `resetMapOnStart` or `testMode.enabled` are ignored (switches off). Rejected: seeding dummy rows into IndexedDB (they would mix with real data and end up in backups).

## ADR-039: Gold ledger and wallet
- Date: 2026-10-07 · Status: Proposed (guidance_v2 Step 2.1; starter gold is §9 Q12)
- Decision: Gold lives in an append-only `ledger` store (`{ id, at, currency: 'gold', amount, reason, refId }`, positive = credit). The balance is the sum, recomputed on load and cached in the store as `gold`. `spendGold(amount, reason, refId, grant)` writes the debit and the granted item in the same storage transaction; a short balance rejects with `InsufficientGoldError` before anything is written, and a failed write leaves the balance unchanged (no memory fallback for purchases). Ledger rows are added, never put, so an existing entry cannot be overwritten. With `features.economy` on, each save gets 30 starter gold once (`balance.economy.starterGold`), detected by a `starter` entry.
- Consequences: Server-authoritative gold (Step 5.5) can replay the same entries. Backups carry the ledger like every store. Rejected: a stored balance field (it can drift from the entries).

## ADR-040: Animal expiry
- Date: 2026-10-07 · Status: Proposed (guidance_v2 Step 2.2; Tiger expiring is §9 Q14)
- Decision: `computeExpirations(animals, now, cfg)` in `shared/rules/expiry.ts` returns every active animal with `acquiredAt + animalLifetimeDays (7) ≤ now`, except `expiryExemptSpecies` (`['unicorn']`; the Tiger expires like any animal), with gold `goldByTierRank[rank]` (`[1, 3, 8, 25]`) and `expiredAt` = the real expiry moment. The store applies the result in one commit: statuses `departed` with `endReason 'expired'`, one ledger credit per animal (`refId` = the animal, `at` = the expiry moment) and one `animals_departed` notice. It runs at app start, after an import, on every transition to Home or Break, and every 60 s while not focusing (Home and Break both, so a break never holds a departure back); never during Focus, so animals that expire during Focus leave when it ends. Concurrent calls share one run.
- Consequences: Running twice gives gold once (departed animals are no longer active). Test-mode and dummy animals are kept in memory: their departures get their own notice and never reach storage. Rejected: one ledger entry per batch (per-animal entries make the server replay and refunds simpler).

## ADR-041: Content is data (content packs and registry)
- Date: 2026-10-07 · Status: Accepted (owner decision rev 3; guidance_v2 §2.13, Step 3.1)
- Decision: Species, skins, skin families, block themes, buildings and releases are JSON files under `content/`, validated by zod schemas in `shared/content/schema.ts`. `buildPack` (`shared/content/pack.ts`) validates every file (schema, unique ids, references to species, models, releases and presets), expands skin families into one skin per species (`family:speciesId`, price by tier, optional per-species overrides) and returns a content pack `{ contentVersion, items, models, atlas? }`. The app bundles a baseline pack (`domain/content/baseline.ts`, `import.meta.glob` over `content/`, models from `src/assets/voxels`) and reads items only through `ContentRegistry` (`domain/content`): per item the newer pack wins, items a newer pack drops stay known (retired: renderable, not sold), and `listed()` hides items outside their availability window or above `minClientVersion`. The species catalog (`CATALOG`) is derived from the registry, unchanged in order and fields. `npm run content:build` writes the pack JSON to `dist-content/` for publishing (Step 5.8).
- New dependency: `zod` (v4, ~15 kB gzip, no dependencies, widely used): schemas double as TypeScript types and run unchanged on the server (Deno). It is the only package `shared/` may import.
- Consequences: A new item is a data file, no code. Skins are per species (§9 Q13). Rejected: hand-written validation (more code, types and checks drift apart); generating a committed pack file (drifts from the sources).

## ADR-042: Content validation budgets and generated sprites
- Date: 2026-10-08 · Status: Proposed (guidance_v2 Step 3.5; regenerating the old collection sprites is §9 Q33)
- Decision: `npm run content:validate` (CI and `npm test`) enforces, beyond schema and references: palette keys from the shared list; animal models and overlays ≤ 16×16×16 and ≤ 800 voxels; buildings at 1/8-block voxels with footprint ≤ 3×3, height ≤ 24 and ≤ 3,000 voxels, and `ceil(model size / 8)` equal to the footprint; prices inside `balance.prices` (family skins 25–60, handcrafted 60–80, themes 120–200, buildings 10–80); `availableFrom` before `availableUntil`; and a fresh sprite per item. `npm run content:sprites` renders all sprites in headless Chromium through the dev server with the island camera and lighting at 48 px, no antialiasing, binary alpha, into one committed atlas whose index stores a hash of each item's inputs (model, colors, renderer version), so stale sprites fail validation. The Collection and Day detail now use these sprites instead of the flat front view.
- Consequences: New content cannot ship without sprites, and old and new sprites look alike. Rejected: rendering sprites at app runtime (one WebGL context per card, slow lists); pixel comparison in CI (GPU-dependent).

## ADR-043: Several chosen skins per species, one per animal
- Date: 2026-10-08 · Status: Accepted (owner request after Phase 3; replaces the §9 Q13 default "one skin per species")
- Decision: `equipped.skinsBySpecies` holds one or more chosen skins per species (Default may be one of them; none listed = Default). A new animal of a species with several chosen skins gets one at random on arrival and stores it (`PlacedAnimal.skinId`). An animal wears its arrival skin while that skin is still chosen; otherwise a fixed pick among the chosen skins (by its id), so changing the choice shows at once and never flickers. The Collection's species sheet toggles owned skins in and out (the last one stays), selects every owned skin at once, and buys the others in place; buying a skin adds it to the choice (replacing Default alone). Old `skinBySpecies` rows are read as a choice of one.
- Consequences: An island can mix looks of one species. War and visits (later phases) draw the same per-animal skin. Rejected: re-rolling skins on every load (animals would change look); storing a skin on every animal (old animals would never follow a new choice).

## ADR-044: Docs sorted into folders by kind
- Date: 2026-10-27 · Status: Accepted (owner request)
- Decision: `docs/` holds `plans/` (guidance), `reference/` (rules the agent reads: ARCHITECTURE, DESIGN, API), `guides/` (how-tos: content, backend and mobile setup), `status/` (PROJECT_STATUS, PROGRESS), `logs/` (CHANGELOG, DECISIONS) and `process/` (LOOP), with a map in `docs/README.md`. Supersedes the flat layout of ADR-028. The guidance's `server/API.md` lives in `docs/reference/API.md` (all docs in `docs/`).
- Consequences: The loop hook config and the guidance deny rule in `.claude/` still name the old paths; the agent may not edit `.claude/`, so the owner updates them (`docs/process/LOOP.md`).

## ADR-046: Island move
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Phase 4; §9 Q15 default "return buildings to the inventory")
- Decision: An island move is one local write: oldest active Unicorn `spent`, new seed, same level, every active animal re-placed with the normal center-weighted rule (sharing when full), pins cleared, all buildings back to the inventory, the old seed in `islandHistory`. The sequence only replays saved data: a reload or Skip shows the new island. Entry is the HUD Unicorn counter (the Phase 2 note); previews are free seeds rolled on the device, at most 3. The sequence draws both islands without their animals and moves the animals itself in world space (no per-island animal logic), with the bob calmed so feet stay on the ground.
- Consequences: Signed in (Phase 5) the same rule runs on the server (`move_island`). Rejected: keeping buildings where they fit (they rarely fit the new terrain and half-kept layouts confuse); an island-move screen of its own (the Unicorn is the currency, so its counter is the natural entry).

## ADR-047: Backend on Supabase, one API edge function running the shared server core
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Steps 5.1–5.3; owner to create the project)
- Decision: Supabase (Postgres, Auth, Storage, Edge Functions; region EU). Every operation goes through one edge function (`api`) that runs the bundled `server/core` (TypeScript, shared rules, domain rules, the content pack) in one Postgres transaction per call; clients never touch tables (RLS on, no policies). Tables store key and filter columns plus the row as `jsonb`, generated from one schema file, so the memory database (tests, fake backend) and Postgres behave the same and one contract suite runs on both (PGlite in tests). The client talks plain HTTPS (`fetch`, no SDK, tokens in secure storage) so web, iOS and Android share it. Realtime presence is polled (Phase 7) instead of a websocket channel.
- Consequences: All server logic is testable locally and identical to the client's rules. Each call is an edge-function invocation (cold starts of a few hundred ms). Rejected: Postgres RPC functions per endpoint (rules written twice, in SQL and TS); Firebase (document model, weak for rankings and multi-row transactions); supabase-js (bundle size, cookie and redirect assumptions on native).

## ADR-048: Sync and account rules
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Steps 5.4–5.7)
- Decision: Focus starts on the device at once; signed in, the server confirms it in the background under the client's session id, and only confirmed sessions get server rewards. A session started offline is rewarded on the device as unverified and uploaded; its animal leaves no gold and counts for nothing in score or war (the server cannot vouch for it). A verified session ended offline waits for the server ("Revealing when you're back online…"). Deltas are merged by row id with one sequence number per server transaction. First sign-in uploads the device save once (gold up to 1,000); an account with data asks which to keep. Signing out or deleting the account clears the device (settings stay) and starts a fresh local island, after offering an export.
- Consequences: Account data cannot be copied into another account through a signed-out device. A user who signs out loses the local view of their island until they sign in again (the account keeps it). Rejected: keeping the data after sign-out (exploitable via "replace account"); trusting offline rewards fully (free gold).

## ADR-045: One folder per animal and building, scaffolded
- Date: 2026-10-27 · Status: Accepted (owner request: "make animals, skins and themes easy to extend")
- Decision: Every item is its own file; items with a model are a folder holding data and model: `content/animals/<id>/{animal.json, model.ts, skins/*.json}`, `content/buildings/<id>/{building.json, model.ts}`, `content/themes/<id>.json`, `content/skin-families/<id>.json`, `content/releases/<id>.json`. The name is the id and `assemblePack` rejects mismatches. Model refs follow the folder (`animals/fox`); loose models (overlays) stay in `content/models/`. `npm run content:new` writes a valid starting point for each kind. Catalog order is tier then id; shop order release date then id (no hand-kept order lists).
- Consequences: Adding an animal is one command plus drawing its model; nothing in `src/` changes. Collection order is alphabetical within a tier (was hand-picked), and which species a given reward roll picks changed (odds unchanged). Rejected: an `order` field per item (one more thing to keep in sync); keeping models in `src/assets` (two places per animal).

## ADR-049: Lock-screen progress by dates (Live Activity, Android chronometer)
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Step 6.8; to verify on devices)
- Platform facts checked: an iOS Live Activity (ActivityKit, iOS 16.1+; content API 16.2+) stays active for at most 8 hours and then up to 4 more hours on the Lock Screen (12 h total); `staleDate` marks content outdated (`context.isStale`) without ending it; `Text(date, style: .timer)` is drawn by the system, counting down to a date and up past it, with no app updates. An activity ended with `dismissalPolicy: .after(date)` stays on the Lock Screen until that date. Android: `NotificationCompat` `setUsesChronometer` + `setChronometerCountDown` (API 24+) with `setWhen(end)` counts down in the system UI and keeps going below zero; `setTimeoutAfter` removes a notification by itself. Android 14+ lets users swipe away ongoing notifications that are not foreground services.
- Decision: One app-local plugin `SiftLiveProgress` (`update`, `end`) on both platforms, fed by the pure `liveStateFor(phase)`: `{ phase, startedAt, endsAt }` + words. iOS: a new activity per phase change; Focus goes stale at its end and then reads "Time's up · open Sift to end focus" while the timer counts the overtime up; a break is ended at once with `.after(endsAt)` so it disappears at the break end without the app. Android: a silent, low-importance ongoing notification with a countdown chronometer (overtime shows as negative time); a break's notification times out at the break end. No actions or buttons; a tap opens the app. Off with Settings › Lock screen timer.
- Consequences: Correct while the app is suspended; no push token or server work. Focus longer than 8 h is not covered on iOS (focus max is far below). The iOS widget extension target must be added once in Xcode (MOBILE_SETUP.md). Rejected: a community plugin (none covers both platforms with date-driven timers); ActivityKit push updates (needs server work and APNs for something dates already solve).

## ADR-050: Capacitor 8 shell and native adapters
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Steps 6.1–6.7)
- Decision: Capacitor 8.5 wraps the same web build (`ios/` with Swift Package Manager, `android/`, bundle id `com.mirecodes.sift`). One `Platform` object: `platform/native/index.ts` implements every adapter with official or established community plugins (SQLite, keep-awake, status bar, local notifications, haptics, filesystem + share, secure storage, app, Firebase messaging), loaded from one lazy chunk; the web bundle never loads it. Native storage is a SQLite file holding the same rows as IndexedDB (JSON per row, same migrations), passing the same contract suite. Timer alerts and lock-screen progress are recomputed from timestamps on every phase or settings change by one binder. Local-notification permission is asked at the first Focus start (that is what it is for); push permission only after a one-line explanation at the first social action or a category toggle. The server pushes only social notices of a category the device keeps on, and never to a user with a running session (the notice waits in the Inbox). Deep links use one shared parser for web paths, universal links, app links and tapped pushes.
- Consequences: Native features are testable on the web build through pure functions and fakes; the native glue itself is verified only by CI builds and on devices. Push needs the owner's Firebase project and APNs key; links need the owner's domain (MOBILE_SETUP.md). Rejected: separate native entry points (two builds to keep equal); `@capacitor/preferences` for the save (not durable or transactional); asking every permission at first launch (store reviewers and users dislike it).

## ADR-051: Handles and the social graph
- Date: 2026-10-27 · Status: Proposed (guidance_v2 Steps 7.1–7.7)
- Decision: A handle is `name#tag`: the name follows one shared rule (2–12 code points after NFC; Hangul syllables, Latin letters, digits; not digits only; not reserved) checked live on the device and again on the server with a Korean/English word filter; the key is NFC + Latin lower case; the server gives a random free 4-digit tag per key and keeps it on a rename when it is still free. The first rename is free, later ones once per 30 days. Friends are one row per pair (pending → accepted; a crossing request accepts); adding needs the exact handle (no search or directory). Blocking deletes the friendship and makes the two invisible to each other (requests answer "not found", no presence, visits or invites); group membership is left to group owners. "Related" (friends now, same group in Phase 8) gates island snapshots, presence and invites. Visits leave one data-driven trace row per visitor, host and day. Presence and rooms are polled. A focus-together room shares the server start time; a late joiner (≤ 2 min) starts at their join time and ends with the room; rewards stay individual.
- Consequences: Hangul and Latin names coexist; impersonation by case or decomposed Hangul is impossible. No social data lives on the device, so these features need a connection. Rejected: user-chosen tags (squatting famous name#tag pairs); fuzzy search (scraping); websockets for presence (ADR-047).

## ADR-052: Groups, ranking weeks and settlement
- Date: 2026-10-28 · Status: Proposed (guidance_v2 Steps 8.1–8.6)
- Decision: One group per user (members keyed by user), 2–10 members, an 8-letter code without look-alike characters, any member invites friends, the owner manages the code, war, members and the name. Ranking weeks run Monday 00:00 to Monday 00:00 in the group's IANA time zone, computed with `Intl` in the shared rules (DST-safe). The island score is the shared rule (active verified animals; war losses at 50 % within the week). Settlement is a pure function of stored data, run by a 15-minute job and lazily on every group read, idempotent through keyed results and deterministic ledger ids; scores are taken as of the week boundary. Missions are counted inside `end_session`'s transaction through a hook, so core code does not depend on groups. The rejoin cooldown applies to leaving and disbanding.
- Consequences: A late or missed job changes nothing; results can be recomputed from the stored balance version. Rejected: client-side week math in each device zone (members would disagree); counting missions in the job (milestone gold would arrive late, after Focus).

## ADR-053: War is decided on the server and replayed
- Date: 2026-10-28 · Status: Proposed (guidance_v2 Steps 9.1–9.9)
- Decision: `declare_war` locks both users, settles them, builds the armies with the shared rules, draws a cryptographic seed and runs the shared deterministic simulation; vanished animals, loot and the war row (armies with positions, rounds, result, seed, balance version) are written in one transaction. The row is the replay: clients only animate it, so a replay, a share link and the defender's view are identical. Cooldown and shield are read from past wars. The replay is a pure timeline (voyage, landing, rounds squeezed to ≤ 26 s) drawn with one instanced mesh per species and skin. Performance targets: 60 fps on a 2020 MacBook Air (M1) in Chrome; ≥ 30 fps with no frame over 50 ms on an iPhone 12 and a Pixel 6a (mid-range references) for 2 × 100 animals and for the 100-animal island; to be measured on those devices before turning `war` on.
- Consequences: No client can influence a result; old wars replay exactly even after balance changes. Rejected: simulating on the client (cheating, diverging replays); storing per-frame positions (large rows).

## ADR-054: Arranging animals pins them, through the layout call
- Date: 2026-10-28 · Status: Proposed (guidance_v2 Steps 10.1–10.3)
- Decision: A dropped animal is stored with `pinned: true` at its tile, checked by one occupancy rule on the device and, signed in, again by the server inside `apply_layout`. Only a building placed on it or an island move clears a pin. Arranging lives in build mode as a second segment; mouse drags at once, touch after a 350 ms long press, and a press released in place picks the animal for a tap-then-Place flow. The camera ignores orbit and pinch while a drag is under way.
- Consequences: Layouts a player made survive rewards, expiry and devices; war formations show them. Signed in, a drop needs the network. Rejected: a separate arrange RPC (two writers of one layout); dragging the camera and the animal with the same gesture (ambiguous on touch).

