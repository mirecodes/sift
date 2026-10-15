# ARCHITECTURE.md

> The coding agent's reference for structure, rules and settled decisions. `docs/DESIGN.md` covers look and feel.
> `(ADR-0xx)` tags point to the human-facing log `docs/DECISIONS.md`; the rule stated here is what counts.
> `[ASSUMPTION]` = default applied, not yet confirmed by the owner (see §12).

## 1. Product

- **Sift**: Pomodoro-style focus timer with collectible rewards (inspiration: Focus Pomo).
- **Loop**: focus → earn a random animal → it is placed on a floating voxel island → the island grows → focus again.
- **Platforms**: Phase 1 local desktop web app (done). Phase 2 iOS/Android by wrapping the same code with Capacitor (deferred, ADR-002).
- **Work model**: features come from `docs/guidance_vN.md`, implemented step by step. Everything so far is guidance_v1.

**Philosophy**: focus is the product, rewards are the garnish. Honest time: rewards only for real, completed focus. Gentle motivation: longer focus helps only slightly, and nothing worse than "no reward" ever happens. The island records accumulated effort.

**Immersion principles** (win every conflict):
1. Nothing interrupts focus: no popups, toasts, badges, or reward animations.
2. Focus shows only the timer over a dimmed island; controls stay hidden until needed.
3. Each cycle transition is one tap.
4. Rewards are revealed only on Break.
5. The timer is never wrong (tab switches, backgrounding, reloads).

## 2. Stack and conventions

| Area | Choice |
|---|---|
| Language / build | TypeScript (strict), Vite |
| UI | React 18, CSS Modules + CSS custom properties from `tokens.css` (ADR-001) |
| 3D | three.js + @react-three/fiber. No drei: custom `CameraRig` (ADR-009) |
| State | Zustand (store with injectable deps) |
| Storage | IndexedDB via Dexie, behind `StorageAdapter` |
| Sound | Synthesized with Web Audio, no audio files (ADR-006) |
| Tests | Vitest (logic), Playwright smoke test `npm run e2e` |
| Mobile (later) | Capacitor |

- All code, comments, docs, commits and UI text in English. UI strings only in `src/ui/strings.ts`.
- **Gameplay** tunables (reward odds, timer limits, placement, and later gold, scoring, war) live in `shared/balance/balance.ts` (frozen, with `BALANCE_VERSION`; bump it on every value change). Client-only tunables (render, UI, island shape) live in `src/domain/config.ts`. Visual values come from `DESIGN.md`; never inline new ones (ADR-030).

## 3. Screens and flow

```mermaid
stateDiagram-v2
    [*] --> Home
    Home --> Focus: Start focus
    Focus --> FocusOvertime: planned time reached
    FocusOvertime --> Break: End focus
    Focus --> Home: Hold to stop (no reward)
    Break --> Focus: Start focus now
    Break --> Home: Home
    Break --> BreakOver: break time reached
    BreakOver --> Focus: Start focus
    BreakOver --> Home: Home
```

| Screen | Rules |
|---|---|
| Home | Island with idle animals; limited rotate/zoom; current cycle + Start focus; top bar (theme, collection, settings) |
| Focus | Fullscreen + wake lock. Near-black overlay over the island as it was at focus start. Large timer only. Hidden "Hold to stop" (1.5 s long press) shows for 3 s on pointer move. At planned time: count-up `+05:23`, one chime, permanent End focus button |
| Break | Reward reveal (card fades in, model spins, tier chime; after 3.5 s or tap the animal joins the island; buttons usable throughout, ADR-011) or a neutral no-reward message. Break countdown, then "Ready for the next one?" with chime. Never auto-starts focus |
| Settings | Focus 5–60 min (step 5), break 1–30 min, chimes toggle; saves instantly |
| Inbox | Deferred notices (`domain/inbox`, store `inbox`, Dexie `inbox`): queued at any time, shown one at a time (oldest first) as a `NoticeCard` on Home and Break only; `dismissNotice` is a no-op while focusing, `selectCurrentNotice` returns nothing during Focus. Visual events tied to a notice play when it is shown, not when the data changed (ADR-035) |
| Tabs | Island (Home/Focus/Break + Settings/Collection pages), Stats, Friends, Group; non-Island tabs appear only with their feature flag, and with one tab there is no tab bar. `activeTab` lives in the store, in memory only (every launch opens on Island). Focus always runs on Island and hides the tab bar; `setTab` is ignored while focusing, and leaving Island ends a running reveal. Space and hold-Esc exist only on Island screens. Other tabs cover the canvas, which stays mounted with `frameloop="never"`; during a break they show a pill with the break timer (ADR-036) |
| Stats | `domain/stats/days.ts`: `aggregateByDay(sessions, { timeZone, from, to })` → one `DayStat` per day (zeros included); `monthSummary(days, { today })`. Only `completed` sessions count (`balance.stats.includeAbandoned`); minutes = real `endedAt − startedAt` (not the reward cap); a session belongs to the local day it **started** in the user's current time zone. Daily average = month total ÷ days elapsed (through today in the current month, all days in past months). Epoch → local date via `Intl.DateTimeFormat`; calendar math on `YYYY-MM-DD` strings in UTC (ADR-037) |
| Collection | All 50 species (silhouettes if not owned, counts if duplicated) + stats: total focus time, completed sessions, species `n / 50` |

## 4. Timer engine

```ts
type Phase =
  | { kind: 'idle' }
  | { kind: 'focus'; startedAt: number; plannedMs: number; sessionId: string }
  | { kind: 'focusOvertime'; startedAt: number; plannedMs: number; sessionId: string }
  | { kind: 'break'; startedAt: number; plannedMs: number; rewardId?: string }
  | { kind: 'breakOver'; rewardId?: string };
```

- Persist only `idle`, `focus`, `break`. `resolvePhase(phase, now)` derives `focusOvertime` / `breakOver`, so they cannot be missed (ADR-003).
- Elapsed = `now() - startedAt`, never accumulated ticks. Display ticks (250 ms) are not a source of truth. Recompute on `visibilitychange`. Phase is persisted on every change and restored on reload.
- **Focus end**, in one DB transaction (no double rewards): effective time `min(endedAt - startedAt, 60 min)` → if ≥ 25 min roll tier, species, tile → save session + animal + next `break` phase.
- Time-dependent logic takes an injected `now()`.

## 5. Rewards

- **Effective focus** = planned + overtime, capped at 60 min. **Minimum 25 min**. Abandon = no reward.
- Focus can be set below 25 min; such sessions earn only with overtime, and the no-reward message explains it (ADR-012) `[ASSUMPTION]`.
- **Tiers**, lowest to highest: Common < Mythic < Epic < Legendary (`TIERS` in `config.ts`; ADR-026/027).
- Tier is rolled; odds interpolate linearly from 25 to 60 min (`[ASSUMPTION]`); species is then uniform within the tier. Pure functions with an injectable RNG: `shared/rules/reward.ts` (generic over the catalog), bound to `CATALOG` in `domain/reward/reward.ts`.

| Tier | 25 min | 60 min | Species |
|---|---|---|---|
| Common | 60% | 50% | 25: Chick, Rabbit, Duck, Hamster, Squirrel, Hedgehog, Mouse, Frog, Fish, Snail, Ladybug, Bee, Butterfly, Beetle, Turtle, Crab, Starfish, Mole, Sparrow, Pigeon, Hen, Guinea Pig, Lizard, Bat, Ferret |
| Mythic | 28% | 32% | 14: Sheep, Pig, Cat, Dog, Goat, Raccoon, Penguin, Owl, Otter, Beaver, Capybara, Axolotl, Parrot, Koala |
| Epic | 10% | 14% | 9: Horse, Cow, Deer, Fox, Wolf, Bear, Panda, Red Panda, Peacock |
| Legendary | 2% | 4% | 2: Unicorn (rainbow mane, rainbow bursts), Tiger (forehead 王). Both sparkle |

- Catalog is static data (`domain/animals/catalog.ts`): `id`, `name`, `tierRank`, `tier` (label), `modelId`, `idleAnimation`, `footprint`. Duplicates allowed; each is placed.
- **Tier rank, never names**: `TierRank` 0 Common … 3 Legendary. Odds (`config.reward.tierAt*` arrays), species pools, chimes (`reveal:<rank>`), styles (`data-tier="<rank>"`), and later gold, scoring and war all key off the rank. Names live only in `TIERS` (stored label) and `strings.tiers` (display); a rename touches those two lists. The only name comparisons left are the frozen Dexie v2/v3 upgrades.

## 6. 3D world

**Island model** (ADR-034)
- The world draws plain data, never the store: `domain/island/model.ts` `buildIslandModel(...)` → `IslandModel { ownerId, seed, islandLevel, blockThemeId, animals[{ id, speciesId, tierRank, tile, skinId }], buildings[], goldPileLevel, championWeek? }`; `IslandMode` = `own | visit | battle | move` (separate from the render mode).
- `world/Scene.tsx` owns the canvas, lights, camera, clouds and render driver and takes `islands: { model, mode }[]`; `world/IslandScene.tsx` draws one model (bob, terrain, stream, camp, animals) with no global state. Several islands sit side by side along the screen's horizontal axis and the camera fits them all; one island renders exactly as before.
- Dev-only: `?twoIslands[=seed]` renders a second island (`app/devTwoIslands.ts`, stripped from production builds).

**Scene and camera**
- One persistent `<Canvas>` for Home, Focus and Break; never remounted. Break reward card uses its own small canvas only while visible; Collection uses 2D pixel sprites (ADR-007).
- Orthographic isometric camera (azimuth 45°, elevation ≈ 35.26°). Fits the island top + 35% of the underside with a 5% margin, re-fits on growth, avoids the screen area under panels (ADR-014).
- Render modes: Home full (60 fps, interaction). Focus dimmed: fixed camera, 24 fps cap, animals at 0.25 speed, no clouds, 1 s camera pull-back. Break full, fixed camera.

**Island**
- Deterministic: same seed + same **island level** = same island. `islandLevel` = lifetime earned animals on this save, whatever their status (`domain/island/level.ts`), so departures never shrink the island (ADR-032). Shapes are **monotone** (growth only adds tiles), so stored animal coordinates (relative to center) stay valid. An island move keeps the level and changes only the seed.
- Size: side = `max(7, ceil(sqrt(level × 3)))`, odd. Near-circular outline (Euclidean + seeded jitter) (ADR-017).
- Terrain levels 1–3, each 0.5 block. Domain-warped noise + weak back-high tilt, terraced (mostly plains, some hills/lowlands), flat around the camp (ADR-018).
- Underside: inverted pyramid with random gaps. Blocks are flat-colored cubes, one `InstancedMesh` per type, ±4% tint (ADR-008).
- During Break with a reward, the island is sized from `level - 1`; the growth (700 ms scale-in) shows when returning Home (ADR-013).

**Camp and night mode** (ADR-016, ADR-017)
- `Settings.theme` `light | dark`, toggled from the top bar, locked during Focus.
- Campfire on (0,0), log cabin on (-2,0) with its door facing the fire, coin pile tile (-2,1) beside the cabin (empty until F3). All three are `CAMP_RESERVED` (never used by animals or buildings) and flat; the pile tile lies inside the stream's camp clearance, so it is always dry.

**Occupancy** (ADR-033)
- `domain/island/occupancy.ts` `getOccupancy({ seed, islandLevel, animals, buildings })` → `Map<"x,z", TileInfo>` with `height, water, campReserved, buildingId?, animalIds, walkable, buildable`. Animal placement and save repair use it; building placement, routines, war formation and island moves must too.
- Save repair runs on every load (`repairPlacements`): an active animal on water, camp, a building or off the island moves to the nearest free tile and is saved. Idempotent.
- Focus routines picked by theme at focus start: day = animals walk into the cabin; night = they sleep near it. They return on Break. Reload into Focus shows the end state; reduced motion snaps.

**Stream** (ADR-020, ADR-021)
- One winding stream per island, from the seed only: best-scoring wobbling chord, avoids the camp, starts at a spring, falls off the rim outward. Cached per seed (~500 path traces).
- Stream tiles keep their natural level with a 0.25 bed cut; water never flows uphill; only the first unbroken run is water. Water tiles are excluded from placement.
- Modules: `domain/island/stream.ts` (path), `world/stream/streamMesh.ts` (ribbon, falls, bank mesh), `world/stream/Stream.tsx` (render, flow, stateless splash particles).

**Animals**
- One 1×1 tile per animal; placed on a random free grass tile near the center; idle stays in the tile: turn, hop, shuffle (ADR-005).
- Exception: the butterfly flaps (separate wing meshes) and flies up to 1.2 tiles from its tile (ADR-024).
- World scale 0.25× (animal voxel = 1/6 block in the model, 1/24 on the island) (ADR-014).
- Model limits: width ≤ 6 voxels; depth ≤ 6, or 8 for Epic and Legendary (ADR-025).
- Poke: clicking an animal (not on Focus) shows a `!` bubble and forces one idle action. Render-only state (ADR-022).
- Voxel models are TS data in `src/assets/voxels/<id>.ts`, merged into one cached `BufferGeometry` per species (hidden faces culled).

## 7. Platform layer

Capability APIs only through `src/platform/<name>/` (interface `index.ts`, web `web.ts`, later `native.ts`):

| Adapter | Web | Native (later) |
|---|---|---|
| `StorageAdapter` | IndexedDB (Dexie) | Capacitor SQLite / Preferences |
| `WakeLockAdapter` | Screen Wake Lock API | keep-awake plugin |
| `FullscreenAdapter` | Fullscreen API | immersive mode |
| `NotifyAdapter` | Web Audio chimes | scheduled local notification for focus end (JS may be suspended) |
| `HapticsAdapter` | no-op | Capacitor Haptics |
| `FilesAdapter` | download link / file picker | share sheet / document picker |

- "Capability API" = storage, wake lock, fullscreen, audio/notifications, haptics. DOM events, `visibilitychange`, `matchMedia`, `Date.now` are fine in `ui/`, `screens/`, `world/` (ADR-010).
- Write no untested native stubs before M7 (ADR-002).

## 8. Data model

```ts
type Tier = 'common' | 'mythic' | 'epic' | 'legendary';
type TierRank = 0 | 1 | 2 | 3;
interface Settings { focusMinutes; breakMinutes; soundEnabled; theme: 'light' | 'dark'; weekStartsOn: 0 | 1; showFocusPresence; liveProgress }
interface FocusSession {
  id: string; startedAt: number; plannedFocusMs: number; endedAt?: number;
  effectiveFocusMs?: number; status: 'running' | 'completed' | 'abandoned'; rewardAnimalId?: string;
  togetherRoomId: string | null;
}
interface PlacedAnimal {
  id; speciesId; tier: Tier; tierRank: TierRank; tileX; tileZ; acquiredAt; sessionId;
  status: 'active' | 'departed' | 'vanished' | 'spent'; endedAt: number | null;
  endReason: 'expired' | 'war' | 'island_move' | null; verified: boolean; pinned: boolean;
}
interface WorldState { seed: number; blockThemeId: string }   // generated once
interface ActivePhase { phase: Phase }  // restores an in-progress session
```

- Dexie tables: `kv` (settings, world, phase, equipped), `sessions`, `animals`, `ledger`, `cosmetics`, `placedBuildings`, `islandHistory`, `inbox`, `contentPacks` (types in `domain/types.ts`). Schema **v4** (v2, v3 rename stored tiers; v4 = guidance_v2 §4.1).
- Animals are never deleted: they change `status`. Only `active` animals are on the island; the Collection counts all.
- Every change adds a new `db.version(n)` with an `upgrade`; never edit old versions. From v4 on, row upgrades are pure functions in `db/migrations.ts`, shared by every storage adapter and the backup import.
- Field names follow the existing tree (`tileX/tileZ`, epoch-ms `acquiredAt`), not the guidance sketch (`tile`, ISO `earnedAt`).
- UUID ids and UTC epoch-ms times, ready for future sync. The island itself is never stored (derived from seed + count).
- **Backup** (Settings → Data): `{ format: 'sift-backup', version: 1, exportedAt, schemaVersion, data: { <store>: rows[] } }` with every store. `StorageAdapter.exportAll` / `importAll` are generic over stores; import validates (`domain/backup.ts`), then replaces all stores in one transaction. Backups from an older `schemaVersion` are upgraded with the same row migrations as the database.

## 9. Runtime config

`config/app.yaml`, bundled at build time (ADR-015, ADR-019):
- `testMode` (`enabled`, `speciesCount`, `allSpecies`): fills the island in memory at startup; never stored, rewards untouched.
- `resetMapOnStart`: new seed and all placed animals deleted on every start.
- Both are honored only in development builds (`import.meta.env.DEV`); production builds force them off (`resolveRuntimeConfig`). Committed value is `false`; enable locally, never commit.
- `features.<name>`: one flag per guidance_v2 phase (`FEATURES` in `runtimeConfig.ts`), read in every build. Committed values are all `false` (a unit test enforces it); the owner turns a phase on once it is finished. The build variable `VITE_FEATURES=stats,…` (or `all`) turns flags on for test builds: `npm run e2e` builds `dist-e2e` with the finished phases' flags (ADR-036).

## 10. Directory structure

```
docs/            ARCHITECTURE, DESIGN, DECISIONS (human log), CHANGELOG, PROJECT_STATUS, guidance_vN
config/app.yaml  runtime config
e2e/             Playwright smoke test
shared/          pure rules that must run identically on client and server (ADR-031)
├── balance/     balance.ts: gameplay tunables + BALANCE_VERSION
├── rng/         the one seeded PRNG (mulberry32) + hash01, clamp, lerp
└── rules/       tier.ts, reward.ts, placement.ts (later expiry, scoring, war, …)
src/
├── app/         App, routing, runtimeConfig.ts
├── screens/     home, focus, break, settings, collection, stats; TabPage, NoticeCard
├── domain/      pure logic: config, types, random, timer/, reward/, animals/, island/ (+stream), stats/
├── world/       Scene, IslandScene, Clouds, RenderDriver, palette, voxel/, island/, animals/, camera/, props/ (camp), stream/, preview/
├── assets/voxels/  animal models + builder
├── store/       Zustand store
├── platform/    adapters (§7)
├── db/          Dexie schema, repositories
└── ui/          tokens.css/ts, strings.ts, hooks, components/
```

- `shared/` imports only `shared/` (relative paths), uses no browser/Node/Deno globals, never calls `Math.random()` or `Date.now()` (inject `Rng` and `now`); `shared/shared.test.ts` enforces this.
- `domain/` imports only itself and `shared/` (`domain/random.ts` re-exports `shared/rng`). `world/` and `screens/` may use `domain/`, `shared/` and `store/`. Capability APIs only in `platform/`.

## 11. Milestones

| | Scope | Status |
|---|---|---|
| M1 | Timer core: cycle, reload-safe, settings | Done |
| M2 | Rewards: 25 min min, 60 min cap, tier roll, atomic commit | Done |
| M3 | Voxel island, growth, camera | Done |
| M4 | Focus immersion: overlay, timer, fullscreen, wake lock, hidden controls, sound | Done |
| M5 | Animals (now 50), idle animations, reward reveal | Done |
| M6 | Collection, stats, responsive layout | Done |
| M7 | Mobile: Capacitor, native adapters, local notifications | Not started |

**Rules for the agent**
- Every `domain/` module has Vitest tests (time math, 25 min threshold, 60 min cap, probabilities sum to 1, island size and monotonicity).
- Check every Focus-screen addition against §1.
- Performance: Home 60 fps with 100 animals (not yet measured); Focus low GPU. No per-frame allocations; dispose on unmount.

## 12. Open questions (current defaults, ADR-004)

| # | Question | Default |
|---|---|---|
| Q1 | Fish tier | Common |
| Q2 | Tier odds 60/28/10/2 → 50/32/14/4 | Accepted |
| Q3 | Animals on Focus | Slowed + day/night routines |
| Q4 | Auto-start focus after break | No |
| Q5 | Ambient sound while focusing | No, end chime only |
| Q6 | Long breaks | Not supported |
| Q7 | Arrange animals | No; poke only |
| Q8 | Non-animal rewards | No |
| Q9 | Stats | All-time totals only |
| Q10 | Accounts / sync | Local only, schema ready |
| Q11 | Mobile approach | Capacitor |

**Known limits**: no pathfinding (routine walks may cross the cabin or stream); the butterfly may fly over water and the camp.
