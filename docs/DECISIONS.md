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
