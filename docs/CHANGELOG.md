# CHANGELOG.md

> Grouped by the guidance file that drove the work (`docs/guidance_vN.md`), newest guidance first.
> Inside a section, newest first: `YYYY-MM-DD · **Category** — what changed`. Categories: Added, Changed, Removed, Fixed, Docs.
> Tier names below use the current ranks (Common < Mythic < Epic < Legendary).

---

## guidance_v2

- 2026-10-07 · **Changed** — Step 0.6: the island is sized by `islandLevel` = lifetime earned animals (any status), so it never shrinks (ADR-032). Only `active` animals are drawn and block tiles for new animals. Existing saves produce the same island.
- 2026-10-07 · **Added** — Step 0.5: `shared/` layer (ADR-031) with the seeded RNG (moved from `domain/random.ts`), tier rank, reward roll and placement rules; `shared/balance/balance.ts` with `BALANCE_VERSION`, reward odds, timer limits and placement bias (ADR-030). A test keeps `shared/` free of platform globals, `Math.random()` and outside imports. Reward odds unchanged; all existing tests pass unmodified.
- 2026-10-07 · **Changed** — Step 0.4: tier logic uses `tierRank` everywhere. Catalog defined by rank; reward odds are rank-indexed arrays; species pools, reveal chimes (`reveal:0…3`), tier styles (`data-tier="0…3"`) and display names (`strings.tiers[rank]`) key off the rank. Removed unused `tierFill`.
- 2026-10-07 · **Changed** — Step 0.3: schema v4 in one migration. Animals get `tierRank`, `status='active'`, `endedAt`, `endReason`, `verified=true`, `pinned=false`; sessions `togetherRoomId`; world `blockThemeId`; settings `weekStartsOn`, `showFocusPresence`, `liveProgress`; new stores ledger, cosmetics, placedBuildings, islandHistory, inbox, contentPacks, kv `equipped`. Row upgrades in `db/migrations.ts` also upgrade v3 backups on import. Tested against a v3 fixture database.
- 2026-10-07 · **Added** — Step 0.2: Settings → Data exports a versioned JSON backup of every store and imports one after validation, a summary and confirmation, replacing all local data in one transaction. New `FilesAdapter` (download / file picker). E2E covers export → fresh profile → import.
- 2026-10-07 · **Fixed** — Step 0.1: `testMode` and `resetMapOnStart` are honored only in development builds; production forces both off. Committed `app.yaml` sets both to `false`. E2E smoke fixed for the 50-species catalog and checks that saved animals survive a reload.

## guidance_v1

- 2026-10-07 · **Docs** — Docs restructured: `ARCHITECTURE.md` condensed and now holds all settled decisions; `DECISIONS.md` is a human-only log; changelog grouped by guidance file; work follows `docs/guidance_vN.md` (ADR-029).
- 2026-10-07 · **Docs** — All docs moved into `docs/` (ADR-028); added `docs/PROJECT_STATUS.md` (planner-level snapshot).
- 2026-09-30 · **Changed** — Tier names reordered twice; final rank Common, Mythic (blue), Epic (pink), Legendary (orange). Odds, chimes and size limits follow the rank; stored animals migrated (DB v2, v3) (ADR-026, ADR-027).
- 2026-09-30 · **Added** — 30 new species, catalog now 50, including Tiger as a second Legendary (ADR-023). Unicorn rainbow bursts. Butterfly redrawn flat, flaps and flies (ADR-024). Tiger, Bear, Cow, Horse 8 voxels deep (ADR-025).
- 2026-09-30 · **Added** — Poke: clicking an animal shows a `!` bubble and triggers one idle action (ADR-022).
- 2026-09-30 · **Changed** — Hut is a log cabin with chimney smoke at night; Home zoom limit 1.4× → 2.1×.
- 2026-09-30 · **Added** — Winding stream: seed-picked path that avoids the camp, spring fountain, curved falls at level steps and over the rim, splash, smooth grass banks; stream tiles keep natural terrain; animals kept off water. Fixed flicker, zigzag bends, rim staircasing and floating banks (ADR-020, ADR-021).
- 2026-09-30 · **Changed** — Terrain: 7×7 near-circular base, levels 1–3 of 0.5 block, terraced warped noise, flat camp; hut moved to (-2,0) facing the fire (ADR-017, ADR-018).
- 2026-09-30 · **Added** — Night mode (persisted theme toggle, night sky, lit campfire), camp (hut + campfire on reserved tiles), Focus routines: day = into the hut, night = sleep nearby (ADR-016).
- 2026-09-30 · **Added** — `config/app.yaml`: `testMode` (+ `allSpecies`) and `resetMapOnStart` (ADR-015, ADR-019).
- 2026-09-30 · **Changed** — Animals at 0.25× on the island, camera fits the island top (ADR-014); wordmark removed from the top bar.
- 2026-09-30 · **Added** — Git repository and first commit; `CLAUDE.md` requires Edit/Write for file edits.
- 2026-09-29 · **Added** — M1–M6: timer core (derived overtime/break-over, reload-safe), rewards (25 min min, 60 min cap, interpolated odds, atomic commit), voxel island with growth and camera rig, Focus immersion (overlay, hold-to-stop, fullscreen, wake lock, 24 fps, chimes), 20 species with idle animations and reward reveal, Collection, Settings, responsive layout, reduced motion. Vitest suite and Playwright smoke test. ADR-001 to ADR-013.
