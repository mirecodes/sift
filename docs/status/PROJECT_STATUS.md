# Sift — Project Status

> Snapshot for planning discussions. Written for a product/planning reader, not for engineers.
> As of 2026-10-28, after guidance_v2 Phase 10: every guidance_v2 phase is built (version 0.1.0, not released).
> Sources of truth (map: `docs/README.md`): `reference/ARCHITECTURE.md` (structure and settled decisions), `reference/DESIGN.md` (look and feel), `guides/CONTENT.md` (how to make and release content), `logs/CHANGELOG.md` (history by guidance file), `logs/DECISIONS.md` (human-only ADR log). guidance_v1 built the app; **guidance_v2** is built, step by step (`PROGRESS.md`): Phases 0 (foundations), 1 (tabs and Stats), 2 (gold economy), 3 (content, cosmetics, buildings, shop), 4 (island move), 5 (backend, accounts, sync), 6 (iOS and Android apps), 7 (friends), 8 (groups), 9 (war) and 10 (arrange animals). Each phase ships behind a feature flag that stays off until the owner turns it on (the owner turned on `economy` and `cosmetics`). Connecting real services (Supabase, Apple/Google sign-in, Firebase/APNs push, store signing) is the owner's next step: `guides/BACKEND_SETUP.md`, `guides/MOBILE_SETUP.md`.

---

## 1. What Sift is

A Pomodoro-style focus timer with a collectible reward. You focus; if the session lasts 25 minutes or more you earn a random animal; the animal moves onto your small floating 3D island; the island grows as your collection grows.

**Core loop:** Focus → Break (reward reveal) → Focus again, each step one tap.

**Guiding rule:** nothing interrupts a focus session. No popups, badges, or animations while focusing; all the fun happens during the break.

**Where it stands:** milestones M1–M6 (the desktop web version) are done, with a lot of world detail on top. guidance_v2 added backup, Stats, the gold economy, content and cosmetics, island moves, an optional account with cloud sync, iOS/Android apps, friends, groups with weekly rankings and missions, wars, and arranging animals. Without an account everything still works on one device; signed in, the server is the source of truth. The server code runs locally and in tests (a fake backend and Postgres); a real Supabase project is not connected yet.

---

## 2. Tech stack and architecture

### 2.1 Stack (plain terms)

| Area | Choice | What it means for planning |
|---|---|---|
| App type | Web app, plus iOS and Android apps wrapping the same build (Capacitor 8) | One code base for three platforms |
| Backend | Supabase (Postgres, auth, one edge function, storage), optional | Accounts, sync, friends, groups, wars; the app works without it |
| UI | React + TypeScript | Standard, well-supported web stack |
| 3D world | three.js (via React Three Fiber) | The island and animals are real-time 3D, drawn in the browser |
| Art | Voxel (Minecraft-like blocks), defined in code or imported from MagicaVoxel | Animals, skins, themes and buildings are data files under `content/`; new ones need no code |
| Sound | Generated in the browser | No audio files; chimes are synthesized |
| Storage | IndexedDB in the browser, SQLite in the apps; the server when signed in | Works offline; signed-in data follows the account |

### 2.2 How the app is organized

Think of it as six layers, each with one job:

1. **Rules (domain)** — timer, reward odds, island shape, animal catalog, stats. Pure logic with no screen or browser code, so it is fully unit-tested.
2. **App state (store)** — the single "what is happening now" (idle, focusing, on break) and the actions that change it.
3. **Screens** — Home, Focus, Break, Settings, Collection (flat 2D interface on top).
4. **World** — the 3D island scene behind the screens. One scene stays alive across Home, Focus and Break, so moving between them feels continuous.
5. **Platform adapters** — every device feature (storage, keep-screen-awake, fullscreen, sound/notifications, vibration, push, links, lock-screen timer) goes through a small adapter, with web and native versions chosen at start.
6. **Server** — `server/core` holds every server rule; `shared/` holds the rules both sides use (scores, weeks, war simulation, names), so they cannot disagree.

### 2.3 Screens and flow

```
Home ──Start focus──▶ Focus ──time reached──▶ Overtime ──End focus──▶ Break ──▶ Break over
  ▲                    │                                               │             │
  └──── Hold to stop (no reward) ◀┘                                    └── Home / Start focus now
```

| Screen | What the user sees |
|---|---|
| Home | Full-screen island with animals, "25 MIN FOCUS · 5 MIN BREAK", Start focus button, theme / collection / settings icons |
| Focus | Near-black screen, big timer, dimmed island behind it. A hidden "Hold to stop" appears on mouse move |
| Break | Reward card (tier badge, spinning 3D animal, name), break timer, "Start focus now" and "Home" |
| Settings | Focus length, break length, chimes on/off. Saves instantly |
| Collection | Stats strip (total focus time, sessions, species found) and a grid of all 50 animals, unfound ones as silhouettes. With cosmetics: island theme picker and a skin sheet per animal |
| Shop | (cosmetics) Featured items, animal skins, island themes, decorations and buildings, bought with gold |
| Build mode | (cosmetics / arrange) Place, move, rotate and store owned buildings; drag animals to new spots |
| Island move | (islandMove) Spend a Unicorn for a new island shape; the animals cross a bridge |
| Friends | (friends) Your `name#tag`, requests, the friend list with "Focusing now", visits, focus together |
| Group | (groups) Ranking, Missions, Wars and Members of your group |
| War replay | (war) The airship voyage and battle, with Skip and 2× |

---

## 3. Implemented features

Legend: **[+]** = not in the initial plan, added later at the owner's request.

### 3.1 Timer and focus session
- Focus length 5–60 min (5-min steps), break 1–30 min. Defaults 25 / 5.
- When planned time is reached, the timer keeps counting up as **overtime** (`+05:23`) until the user taps End focus.
- **Hold to stop** (1.5 s long press) to abandon; abandoning gives no reward.
- Timer stays correct across tab switches, sleep, and page reloads; an in-progress session resumes after reload.
- Focus enters fullscreen and keeps the screen awake.
- Controls on Focus auto-hide after 3 s.
- Gentle chimes at focus end and break end (toggle in Settings).
- Break ends in a "Ready for the next one?" state; the next focus never starts automatically.
- Keyboard: Space = main action, hold Esc = stop. Reduced-motion setting of the OS is respected.

### 3.2 Rewards
- Reward only if effective focus time ≥ 25 min. Effective time = planned + overtime, **capped at 60 min**.
- Tier is rolled at random; longer focus nudges the odds up slightly:

  | Tier (low → high) | Odds at 25 min | Odds at 60 min | Species |
  |---|---|---|---|
  | Common | 60% | 50% | 25 |
  | Mythic | 28% | 32% | 14 |
  | Epic | 10% | 14% | 9 |
  | Legendary | 2% | 4% | 2 (Unicorn, Tiger) |

- Species is picked uniformly within the tier. Duplicates are allowed and each one is placed on the island.
- Reveal on the Break screen: card fades in, model spins, a tier-specific chime plays; after 3.5 s (or a tap) the animal appears on the island.
- Sessions under 25 min show a neutral, non-guilt message instead.

### 3.3 Island and world
- Floating voxel island in a fixed isometric view; bobs gently; clouds drift behind it.
- Island grows with the number of animals; the same save always produces the same island.
- Growth plays as a short animation when returning Home after a reward.
- Animals are placed automatically on a free tile near the center and play idle animations (turn, hop, shuffle). Fish flops; Legendary animals sparkle.
- Home allows limited rotation and zoom of the island.
- Focus dims the island, slows animals to 25% speed and lowers the frame rate to save battery.
- **[+] Terrain heights** — hills, plains and lowlands instead of a flat top; the area around the camp stays flat.
- **[+] Stream** — every island has one winding stream with a bubbling spring, small waterfalls at height steps, a fall off the island edge, and splash particles. Animals are never placed on water.
- **[+] Night mode** — day/night toggle in the top bar (saved). Night has a starry sky, cool moonlight and a lit campfire.
- **[+] Camp** — every island has a campfire in the center and a log cabin next to it (smoke from the chimney at night).
- **[+] Focus routines** — when focus starts, animals react: by day they walk into the cabin; by night they lie down and sleep near it. They come back out on Break.
- **[+] Poke an animal** — clicking an animal (not during Focus) shows a "!" bubble and makes it do one action.
- **[+] Special animations** — the butterfly flaps and flies around above the island; the unicorn bursts rainbow particles every few seconds.

### 3.4 Collection and stats
- Grid of all 50 species with pixel-art sprites, tier badges and "×3"-style counts; unfound species are silhouettes with "???".
- Stats: total focus time, completed sessions, species found (`n / 50`). All-time totals; with the economy on, each card also shows how many of that species are on the island now.
- **Stats tab** (guidance_v2 Phase 1, flag `stats`): bottom tab bar; daily average, month bar strip, month heatmap calendar, week view and a day sheet listing every session. Week can start on Monday or Sunday.

### 3.5 Developer-only switches **[+]**
- `config/app.yaml` → `testMode` (bundled at build time, honored only in development builds; production forces them off):
  - **animals** — fills the island with animals at startup (in memory, never saved). Can place every species at once.
  - **resetMapOnStart** — new island and no saved animals on every launch.
  - **dummyData** — sample data in memory for reviewing new features: six weeks of sessions, Inbox notices, gold, and animals of every age (some leave right away).
- All are **off** in the committed file.

### 3.6 Gold economy (guidance_v2 Phase 2, flag `economy`)
- Animals now stay **7 days**. Then they leave the island and leave gold: 1 / 3 / 8 / 25 by tier (Common → Legendary). The **Unicorn never leaves** (it pays for island moves).
- Departures never happen during Focus; they are applied at the next Home or Break, and on app start (a long absence settles all at once).
- A small card on Home or Break says "4 animals left 9 gold." Only then do the animals puff away and coins fly into a **coin pile** next to the cabin, which grows in six sizes with the balance.
- Top bar on Home: gold counter (counts up) and Unicorn count. Tapping gold explains it until the Shop exists (Phase 3). Every save gets **30 starter gold** once.
- Poking an animal shows its time left ("3d left").
- The island never shrinks when animals leave; the Collection keeps counting every animal ever earned.

### 3.7 Content pipeline (guidance_v2 Phase 3)
- Every species, skin, skin family, island theme, building and release is a **data file** in `content/`, checked automatically (`npm run content:validate`, also in CI): names in English and Korean, prices inside the allowed ranges, size budgets, footprints, dates, and an up-to-date picture.
- New shapes are made in **MagicaVoxel** (imported with `npm run content:vox`) or with a small code builder for simple decorations. Visual behavior (spinning sails, falling snow, lantern glow) comes from a fixed set of **presets** an item names.
- **Content Studio** (`/studio` in the development server): browse and filter everything, preview any item on a sample island by day and night and in every theme, tune a skin family across all 50 animals at once, test where a building fits, and save edits back to the files.
- `npm run content:sprites` renders the pixel-art pictures for the Collection and Shop from the 3D models (the old flat pictures were replaced so everything matches).
- The app ships with one **content pack**; newer packs can arrive from the server without an app update (flag `remoteContent`). `docs/guides/CONTENT.md` is the step-by-step release guide.

### 3.8 Cosmetics, shop and buildings (guidance_v2 Phase 3, flag `cosmetics`)
- First release `v2-launch`: island themes Autumn, Snow, Desert and Cherry Blossom (next to the free Meadow); Fence, Lantern, Flower Bed, Well, Small Tree, Stone Statue, Windmill (turning sails), Footbridge (goes over the stream) and the Champion Flag (not for sale, for group winners later); skin families Golden, Snowy, Shadow, Pastel and Ghost for every animal, plus White Tiger and Night Unicorn.
- **Shop**: opened by tapping the gold counter. Featured row, New and "Leaves in 3d" badges, skins only for animals you have met, a turning preview before buying. Prices: skins 25–60 (handcrafted 80), themes 120–200, buildings 10–80.
- **Skins**: pick one or several per species in the Collection (picture cards; buy missing ones right there). New animals arrive in one of the picked skins at random and keep it. **Themes** recolor the whole island (and add falling leaves, snow, petals or glints); since the owner's feedback there are also **Winter** and **Future City** (glassy blue with rainbow tiles).
- The Shop has filters (section, animal, skin style, hide owned, affordable); build mode lists placed buildings to store them; the island turns up to 135° either way.
- **Build mode** (hammer icon on Home): place owned buildings on tiles that fit (green/red preview), rotate, move or store them. Animals standing there walk to a free tile.
- Animals now **walk around** buildings, water and cliffs on their way to the cabin and back. When the island is full they share tiles (up to four per tile).

### 3.9 Island move (Phase 4, flag `islandMove`)
- Tap the Unicorn counter: pick one of a few new island shapes, spend one Unicorn, and watch the animals cross a rainbow bridge while the old island sinks. A history of past islands is kept.

### 3.10 Accounts, sync and the server (Phase 5)
- Optional sign-in (email code, Apple, Google). The first sign-in uploads the local save; after that the server decides rewards, departures, purchases and layouts, and the device keeps a copy for offline use. Sign out clears the device.
- Every server rule runs on a fake in-memory backend for development (any email, code `000000`) and on Postgres in tests. API: `reference/API.md`.

### 3.11 Mobile apps (Phase 6)
- iOS and Android projects (`ios/`, `android/`) built in CI. Native storage (SQLite), focus-end notifications even when the app is closed, haptics, share-sheet export, push notifications by category, deep links (`/join/CODE`, `/add/name-tag`, `/war/id`), pinch zoom, and a lock-screen timer (iOS Live Activity, Android notification).

### 3.12 Friends (Phase 7, flags `friends`, `presence`, `together`, `visitTraceProp`)
- Names like `mina#4821` (Korean or Latin letters), a word filter, block and report. Add friends by name or link, visit their islands, see who is focusing now, and **focus together** (a shared start; everyone keeps their own reward).

### 3.13 Groups and war (Phases 8–9, flags `groups`, `missions`, `war`)
- Groups of 2–10 with a join code. A weekly **ranking** by island score (Monday to Monday in the group's time zone); the winner gets gold and a champion flag on their island. A weekly group **mission** (focus minutes) pays gold at milestones.
- **War**: attack a group member's island. The server decides the battle from a random seed and stores it; everyone watches the same replay (airship, landing, duels). Losers can vanish; the winner loots some gold. Protection for new members, cooldowns and shields limit it.

### 3.14 Arrange animals (Phase 10, flag `arrange`)
- In build mode, drag an animal to a new tile (or tap it, then tap a tile). It stays there: new animals and departures never move it; a building put on it or an island move does.

---

## 4. Data model

Without an account all data stays on the device (IndexedDB in the browser, SQLite in the apps). Signed in, the server keeps the same records plus the social ones (profiles, friendships, visits, groups, weekly results, wars) and the device keeps a copy.

| Record | One per… | Key contents |
|---|---|---|
| **Settings** | app | focus minutes, break minutes, chimes on/off, theme (day/night) |
| **World** | app | the island seed (a random number fixed once; it decides the island's shape, terrain and stream) |
| **Active phase** | app | what is happening right now (idle / focusing since X / on break since X, with the pending reward). Lets a reload resume exactly where the user was |
| **Focus session** | focus attempt | start time, planned length, end time, effective length, status (running / completed / abandoned), the reward it produced |
| **Placed animal** | earned animal | species, tier, tile position on the island, pinned or not, when earned, which session earned it, status (on the island / departed / lost in a war / spent on a move), verified by the server or not |
| **Gold ledger** | gold movement | amount (+ earned, − spent), why, when; the balance is the sum |
| **Owned item** | skin, theme or building bought | which item, when, from where; buildings can be owned several times |
| **Equipped** | app | the skin chosen per species and the island theme |
| **Placed building** | building on the island | which building, tile, rotation |
| **Inbox notice** | thing to tell the user | e.g. "animals left N gold"; shown later on Home or Break, never during Focus |

Notes for planning:
- The island itself is **not stored**: it is recomputed from the seed plus the number of animals ever earned (so it never shrinks). Only animal positions are stored, and they stay valid as the island grows.
- Ending a focus writes the session, the new animal and the switch to Break in **one atomic step**, so a crash cannot double-reward or lose a reward. Departures (statuses, gold, notice) and purchases (debit plus item) are atomic the same way.
- IDs are UUIDs and times are UTC timestamps; sync uses the same rows. Server tables and migrations are generated from one schema file (`npm run server:sql`).
- The database schema is at **version 4** (guidance_v2: animal status, ledger, inbox and stores for later phases). Versions 2 and 3 only rename stored tier names (see 5.2).
- **Backup**: Settings → Data exports everything to a JSON file and imports it back (replacing all local data after a confirmation).
- The 50-species catalog and all shop items are content data shipped with the app (a content pack), not stored in the database. Owned items keep working even if a later pack takes them out of the shop.

---

## 5. Changes from the initial plan, and why

The initial plan is the first version of `ARCHITECTURE.md` (2026-09-29). Changes are recorded as ADRs in `DECISIONS.md`.

### 5.1 Content and world

| Initial plan | Now | Why |
|---|---|---|
| 20 animals | **50 animals** | Owner request: more variety, including insects, birds and sea creatures (ADR-023) |
| Unicorn as the only top-tier animal | **Unicorn + Tiger** | Owner request (ADR-023) |
| 5×5 island, slightly rounded square, flat top | **7×7, near-circular, terraced hills and lowlands** | Owner request: a more natural, less boxy island (ADR-017, ADR-018) |
| Animals about one block in size | **Animals at 1/4 scale; camera zoomed to the island top** | Owner request: animals look like small creatures in a landscape, blocks look larger (ADR-014) |
| No water | **Winding stream with spring and waterfalls** | Owner request. Added, removed, then re-added with a better design (ADR-020, ADR-021) |
| Day only | **Day/night theme, camp, focus routines** | Owner request: gives Focus a visible "the animals rest too" moment without breaking immersion (ADR-016) |
| No interaction with animals (Q7) | **Click to poke** (still no rearranging) | Owner request: small delight on Home/Break (ADR-022) |
| Every animal stays in its own tile | **Butterfly flies around**; large animals have longer bodies | Owner request for liveliness; rule relaxed per species only (ADR-024, ADR-025) |

### 5.2 Tier names (changed twice)

The initial plan ranked tiers Common < Epic < Legendary < Mythic. They were renamed twice (ADR-026, ADR-027) and now rank **Common < Mythic < Epic < Legendary**, with Legendary as the top. The probabilities, chimes and model sizes stay attached to the rank, not the name; stored animals were migrated automatically.

Why: owner preference for "Legendary" as the top word. **Watch out:** older ADRs and changelog entries use the old names, which reads confusingly.

### 5.3 Technical choices that differ from the first draft

| Draft | Now | Why |
|---|---|---|
| CSS Modules or Tailwind (undecided) | CSS Modules | Keeps one source of design tokens (ADR-001) |
| drei helper library for 3D | Not used; custom camera | Off-the-shelf controls fought the fixed isometric view and screen transitions (ADR-009) |
| Sound files | Synthesized chimes | No asset files, easier on mobile (ADR-006) |
| Mobile in M7 | Built in guidance_v2 Phase 6 (Capacitor 8) | Web first, then the same build in native shells (ADR-002, ADR-049) |
| No server | Optional Supabase backend | Social features need one; local-only use stays (ADR-047, ADR-048) |
| Wordmark in top bar | Removed | Less UI over the island |

---

## 6. Known issues, tech debt, unfinished parts

### 6.1 Must fix before any release
- Fixed in guidance_v2 Phase 0: developer switches are off and can no longer reach production builds; backup export/import exists.
- Before turning on `features.economy` for real users: confirm the starter gold (Q12) and that the Tiger expires (Q14), and review the departure look (`PROGRESS.md`, owner review queue).
- Before turning on `features.cosmetics` (it needs `economy` for gold): review the launch content, Shop, Collection and build mode (`PROGRESS.md`, owner review queue) and confirm skins per species (Q13) and the new sprite style (Q33).
- Before turning on any social flag: connect Supabase (`guides/BACKEND_SETUP.md`); before a store release: signing, push keys, the link domain and device checks (`guides/MOBILE_SETUP.md`, `guides/STORE_READINESS.md`).
- Before turning on `war`: measure the replay on the reference devices (ADR-053).

### 6.2 Unfinished / not started
- Real services are not connected: Supabase, Apple/Google sign-in, email delivery, Firebase/APNs push. The fake backend stands in until then.
- The native apps are built in CI but were never run on a device here.
- No onboarding / first-run screen.
- No localization (all text is in one file, English only; names accept Korean).
- The war loot-chest walk is not drawn (the gold shows in the result).

### 6.3 Gameplay and world limitations
- **Short focus never pays**: focus can be set to 5–20 min, but rewards need 25 min, so short-session users never earn anything without overtime (ADR-012, owner should confirm).
- Animals find a way around buildings and water, but paths follow the tile grid (no diagonals); an animal cut off by the stream (no footbridge) still walks straight across it.
- The butterfly can fly over water and the camp.
- On the smallest island the stream can end up almost straight.
- Adding species lowers each species' chance within its tier (pick is uniform), so the 25 Common species are slow to complete.
- Tier card colors (blue, pink, orange with white text) are below the target contrast ratio; the tier name is always shown as text to compensate.
- The 100-animals-at-60fps performance target has not been measured.

### 6.4 Decisions still waiting for the owner
Several ADRs are **Proposed**, meaning a default was applied but not confirmed: styling (001), mobile deferral (002), open-question defaults (004), one tile per animal (005), synthesized sounds (006), reward preview (007), terrain blocks (008), Break layout (011), short focus (012), night mode and camp (016).

Open questions from the plan, with the current default (ADR-004):

| # | Question | Current default |
|---|---|---|
| Q1 | Fish tier | Common |
| Q2 | Tier odds (60/28/10/2 → 50/32/14/4) | Accepted as is |
| Q3 | Animals during Focus | Slowed (plus the day/night routines) |
| Q4 | Auto-start next focus after break | No |
| Q5 | Ambient sound during focus | None, end chime only |
| Q6 | Long breaks (e.g. every 4 cycles) | Not supported |
| Q7 | User can arrange animals | Yes, behind `arrange` (Phase 10) |
| Q8 | Rewards other than animals | No |
| Q9 | Stats screen | Simple all-time totals |
| Q10 | Accounts / sync | Optional account, server-authoritative (Phase 5) |
| Q11 | Mobile approach | Capacitor wrapper (built) |

### 6.5 Documentation drift
- Older ADRs use pre-rename tier names (`ARCHITECTURE.md` and `CHANGELOG.md` were rewritten with the current names on 2026-10-07).
- The `footprint` field (animals larger than one tile) exists in the catalog but is unused.

### 6.6 Quality
- 798 unit tests pass and type checking is clean (checked 2026-10-28, after Phase 10); `npm test` also runs the content validation and every server suite on both the in-memory database and Postgres (PGlite).
- Browser smoke test `npm run e2e` (72 checks: Stats, a week-long fast-forward to a departure, Shop and build mode, arrange mode, names, groups, wars) builds its own bundle with the finished phases' flags and passes.
- CI (`.github/workflows/ci.yml`) runs type checking, unit tests and content validation, and builds a debug Android APK and an iOS simulator app on every push.
- guidance_v2 work is on branch `sift-v2`, one commit per step.
