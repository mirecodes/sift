# DESIGN.md

> Single source of truth for Sift's design.
> **Part I — UI Design** covers everything drawn in the DOM (screens, text, buttons, panels, timer, sound, copy).
> **Part II — Rendering** covers everything drawn by three.js (sky, island, blocks, animals, camera, lighting).
> The two parts never share colors: UI tokens are not used on 3D objects, and world colors are not used in UI components.

---

## 0. Design Principles

1. **Calm over exciting.** The app supports focus; it never competes for attention.
2. **Engineered restraint.** Near-black and white carry the interface. Color is rare and meaningful.
3. **Confident, not loud.** Type weights stay between 400 and 600.
4. **Dark and quiet while focusing, bright and alive at rest.** Focus = near-black and minimal. Home / Break = white UI over a colorful island.
5. **Accents are surfaces, not actions.** Chromatic colors fill cards and badges (reward tiers). Buttons are near-black or white.
6. **Reward delight happens after the work.** Celebratory motion only on the Break screen.
7. **Less UI.** If an element is not needed right now, hide it.

---

# Part I — UI Design

## 1. Design Language

The interface follows a Webflow-inspired language: a deep near-black `#080808` primary against a clean white canvas, a small set of saturated chromatic accents used as **surface fills** (never as buttons), and a single sans-serif family at restrained 400–600 weights with slight negative tracking at large sizes.

**Key characteristics**
- **Two-color action hierarchy.** Near-black for every primary action on light surfaces (white on dark surfaces), white-with-hairline for secondary actions.
- **Chromatic accents as surfaces.** Used at full saturation as reward-tier card fills and badges. In Sift, color appears mainly when a reward appears, which makes rewards feel valuable.
- **Single type family.** One family for display, body, and labels; variable weights do the work.
- **Tight, engineered shapes.** 4px buttons, 8px cards. No pill buttons.
- **Layered soft shadows** are the only elevation cue, used on panels floating over the island.

All tokens live in `src/ui/tokens.css` (CSS custom properties) and are mirrored in `src/ui/tokens.ts`. Never hard-code a value in a component.

---

## 2. Colors

### 2.1 Core

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#080808` | Primary buttons, headings, wordmark, Focus background. Deeper than pure black to read as intentional |
| `--color-on-primary` | `#FFFFFF` | Text/icons on primary; the Focus timer |
| `--color-canvas` | `#FFFFFF` | Panels, cards, sheets, Settings/Collection background |
| `--color-hairline` | `#D8D8D8` | 1px borders, dividers, input borders |
| `--color-hairline-inverse` | `rgba(255, 255, 255, 0.16)` | 1px borders on dark surfaces |
| `--color-overlay-focus` | `rgba(8, 8, 8, 0.82)` | Covers the island on the Focus screen |
| `--color-overlay-focus-night` | `rgba(8, 8, 8, 0.6)` | Same, in night mode, so the campfire and sleeping animals stay visible |
| `--color-backdrop` | `rgba(8, 8, 8, 0.4)` | Behind modal sheets (Day detail) |

### 2.2 Text

| Token | Value | Usage |
|---|---|---|
| `--color-ink` | `#080808` | Default text, headings |
| `--color-ink-strong` | `#222222` | Near-black emphasis |
| `--color-body` | `#363636` | Body paragraphs |
| `--color-body-mid` | `#5A5A5A` | Secondary text, captions |
| `--color-mute` | `#898989` | Low-priority text |
| `--color-mute-soft` | `#ABABAB` | Placeholders; secondary text on dark surfaces |

### 2.3 Accents

Surface fills, badges, and indicators only. **Never button backgrounds. Never add a new accent.**

| Token | Value | Sift usage |
|---|---|---|
| `--color-accent-purple` | `#7A3DFF` | Reserved (was the Epic tier before ADR-027) |
| `--color-accent-orange` | `#FF6B00` | Legendary tier (the top tier); Overtime badge |
| `--color-accent-pink` | `#ED52CB` | Epic tier |
| `--color-accent-blue` | `#3B89FF` | Mythic tier |
| `--color-accent-blue-info` | `#146EF5` | Info badge |
| `--color-accent-green` | `#00D722` | Success indicator (reserved) |
| `--color-accent-yellow` | `#FFAE13` | Warning (reserved) |
| `--color-accent-red` | `#EE1D36` | Destructive: Abandon long-press ring, errors |

### 2.4 Tier Mapping

| Tier | Card / badge fill | Text |
|---|---|---|
| Common | `--color-canvas` + 1px `--color-hairline` | `--color-ink` |
| Mythic | `--color-accent-blue` | `--color-on-primary` |
| Epic | `--color-accent-pink` | `--color-on-primary` |
| Legendary | `--color-accent-orange` | `--color-on-primary` |

Rank order, lowest to highest: Common (white), Mythic (blue), Epic (pink), Legendary (orange). Styles, chimes and sizes are keyed by rank 0–3 (`data-tier="0"` … `"3"`, `reveal:0` … `reveal:3`), never by name, so a rename only touches the strings file.

- No gradients in the UI. (The unicorn's rainbow effects belong to Part II.)
- Tier is never conveyed by color alone; always show the tier name.

---

## 3. Typography

### 3.1 Family
- **Inter** (self-hosted, `font-feature-settings: "ss01"`) for every role. Weights **400 / 500 / 550 / 600 only**.
- **Inconsolata** for rare technical/mono labels.
- Fallback: `Inter, system-ui, -apple-system, sans-serif`.
- Fonts are bundled locally; no runtime requests to font servers.

### 3.2 Hierarchy

| Token | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `timer` | `clamp(96px, 22vw, 240px)` | 500 | 1.0 | -1% | Focus timer (`tabular-nums` required) |
| `timer-sm` | `clamp(64px, 14vw, 120px)` | 500 | 1.0 | -1% | Break timer |
| `display-xl` | 56px | 600 | 58.24px | -0.56px | Reserved (onboarding) |
| `display-lg` | 44.8px | 600 | 46.6px | 0 | Reward animal name |
| `display-md` | 32px | 500 | 41.6px | 0 | Screen titles |
| `display-sm` | 24px | 500 | 31.2px | 0 | Sub-section titles |
| `display-xs` | 20px | 500 | 28px | 0 | Card titles |
| `eyebrow` | 15px | 500 | 19.5px | +1.5px, UPPERCASE | Section labels (`FOCUS`, `BREAK`, `TIMER`) |
| `eyebrow-sm` | 12px | 500 | 12px | +0.6px, UPPERCASE | Tier badges, metadata |
| `body-md` | 16px | 400 | 25.6px | -0.16px | Default body |
| `body-md-strong` | 16px | 500 | 25.6px | -0.16px | Emphasized body, wordmark |
| `body-sm` | 14px | 400 | 22.4px | 0 | Secondary text |
| `body-sm-strong` | 14px | 500 | 22.4px | 0 | Labels |
| `caption` | 12.8px | 550 | 15.36px | 0 | Badges, counters |
| `caption-mono` | 12px | 400 | 18px | 0 | Technical labels (Inconsolata) |
| `button` | 16px | 500 | 25.6px | -0.16px | Button labels |

### 3.3 Rules
- Never 700+; never below 400.
- Negative tracking at large sizes only.
- Uppercase only for eyebrows and badges; everything else in sentence case.
- Timer digits always use `font-variant-numeric: tabular-nums` so the layout never shifts.

---

## 4. Layout

### 4.1 Spacing (base unit 4px)

| Token | Value |
|---|---|
| `--space-xxs` | 2px |
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 20px |
| `--space-2xl` | 24px |
| `--space-3xl` | 32px |
| `--space-layout-lg` | 48px (screen-level rhythm only) |
| `--space-layout-xl` | 64px (screen-level rhythm only) |

- Screen gutters: `--space-3xl` (desktop), `--space-lg` (mobile).
- Card padding: `--space-3xl` (desktop), `--space-2xl` (mobile).

### 4.2 Breakpoints

| Name | Width | Changes |
|---|---|---|
| Mobile | < 480px | 1-up grids; bottom actions full width |
| Mobile-large | 480–767px | Same as Mobile |
| Tablet | 768–991px | Collection 3-up |
| Desktop | ≥ 992px | Collection 4-up |

### 4.3 Touch and Safe Areas
- Minimum touch target 44px (buttons: 12px vertical padding + 25.6px line height).
- Respect safe-area insets for future mobile builds.
- The timer is optically centered (~4% above true center).

---

## 5. Shapes and Elevation

### 5.1 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0px | Full-bleed surfaces |
| `--radius-xs` | 2px | Tiny inline tags |
| `--radius-sm` | 4px | Buttons, badges, inputs |
| `--radius-md` | 8px | Cards, panels, sheets, modals |
| `--radius-full` | 9999px | Circular icon buttons, toggles, long-press ring only |

### 5.2 Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 Flat | None | Full-screen surfaces |
| 1 Hairline | 1px `--color-hairline` | Default cards, inputs |
| 2 Layered | `0 54px 22px rgba(0,0,0,0.01), 0 30px 18px rgba(0,0,0,0.04), 0 13px 13px rgba(0,0,0,0.08), 0 3px 7px rgba(0,0,0,0.09)` | Panels over the island, reward card |
| 3 Layered strong | Level 2 with last stop at `0.12` | Collection detail sheet |
| 4 Modal | `0 24px 24px rgba(0,0,0,0.26), 0 6px 13px rgba(0,0,0,0.29)` | Confirmation dialogs |

- No shadows on the Focus screen.

---

## 6. Components

### 6.1 Buttons
All buttons: `button` type, `--radius-sm`, padding `--space-md` `--space-xl`. One primary button per screen.

| Component | Surface | Style |
|---|---|---|
| `button-primary` | Light | `--color-primary` fill, white text |
| `button-primary-inverse` | Dark | White fill, `--color-ink` text |
| `button-secondary` | Light | Canvas fill, ink text, 1px hairline |
| `button-secondary-inverse` | Dark | Transparent, white text, 1px `--color-hairline-inverse` |
| `button-icon-circular` | Any | 40px circle, `--radius-full`; canvas (light) or transparent (dark) |
| `button-hold` | Dark | `button-secondary-inverse` + `--color-accent-red` ring filling over 1.5s; release cancels |

- Pressed: opacity 0.85 over 150ms. No scale bounce.

### 6.2 Surfaces

| Component | Style |
|---|---|
| `panel` | Canvas, `--radius-md`, Level 2, padding `--space-2xl` |
| `card-feature` | Canvas, 1px hairline, `--radius-md`, padding `--space-3xl` |
| `card-feature-dark` | `--color-primary`, white text, `--radius-md` |
| `card-tier` | Tier fill (2.4), `--radius-md`, padding `--space-3xl`, name in `display-xs` |
| `modal` | Canvas, `--radius-md`, Level 4, padding `--space-3xl` |
| `toast` | `panel` style, `body-sm`, padding `--space-md` `--space-lg`, auto-dismiss 3s |

### 6.3 Badges

| Component | Style |
|---|---|
| `badge-tier` | Tier fill, `eyebrow-sm`, `--radius-sm`, padding `--space-xs` `--space-sm` |
| `badge-overtime` | `--color-accent-orange`, white `eyebrow-sm` `OVERTIME`, `--radius-sm` |
| `badge-info` | `--color-accent-blue-info`, white `caption`, `--radius-sm` |

### 6.4 Inputs

| Component | Style |
|---|---|
| `number-input` | Canvas, ink, 1px hairline, `body-md`, `--radius-sm`, padding `--space-md` `--space-lg`; focused border `--color-primary` |
| `stepper` | `number-input` between two `button-secondary` (− / +) |
| `toggle` | 44×24, `--radius-full`; on `--color-primary`, off `--color-hairline` |
| `settings-row` | `body-md` label, control right-aligned, 1px hairline divider |
| `segmented` | Two or more `button` options side by side in a 1px hairline frame, `--radius-sm`, each min 44px tall, `body-sm-strong`; selected = `--color-primary` fill with white text (`aria-pressed`) |

### 6.5 Top Bar (Home, Settings, Collection)
- Transparent over the island (Home) or canvas (others), padding `--space-lg` `--space-3xl`.
- No wordmark. Right-aligned: `button-icon-circular` theme toggle (moon in day mode, sun in night mode) as the rightmost button, after for Collection and Settings (on Settings and Collection, a single close icon returns Home).
- Never on Focus.
- With the economy on, Home's top bar also holds the HUD counters on the left (6.8).

### 6.6 Icons
- Inline SVG, 20×20 viewBox, 1.5px stroke, `currentColor`, no fill, square line caps. Inside a 40px `button-icon-circular`.
- Set: `collection` (2×2 grid of squares), `settings` (three horizontal sliders), `close` (×). Every icon button has an `aria-label`.
- Tab icons: `island` (cabin on a block), `stats` (three bars on a baseline), `friends` (two heads), `group` (flag).
- HUD icons: `gold` (a coin: circle with a smaller inner ring, filled `--color-accent-yellow` under the stroke), `unicorn` (a spiral horn: a tall narrow triangle with two diagonal bands).
- `build` (a hammer: a rectangular head across the top and a diagonal handle), on Home's top bar before `collection`, only with `features.cosmetics`.

### 6.7 Tab Bar
- Tabs **Island**, **Stats**, **Friends**, **Group**; a tab appears only when its feature flag is on. With only Island visible there is no tab bar (the app looks as before).
- `tab-bar`: canvas, `--radius-md`, Level 2, padding `--space-xs`, fixed at the bottom center (`--space-lg` + safe area from the bottom). Each tab is a button (min 72×48px) with the tab icon over a `caption` label; inactive `--color-body-mid` on transparent, active `--color-primary` fill with `--color-on-primary` (polarity flip, like a primary button), `--radius-sm`. Active tab marked `aria-current="page"`.
- Shown on Home, Break and the Stats / Friends / Group pages. Hidden on Focus (focus rule) and on Settings and Collection (they have their own close button).
- While it is shown, floating panels over the island move up by `--tabbar-space` (64px) so they clear it.
- `break-pill`: on any tab other than Island during a break, a `--color-primary` button with white `body-sm-strong` tabular text `Break 03:12` (`Break over` once the time is up), `--radius-sm`, Level 2, centered just above the tab bar. Tapping it returns to Island. The break-end chime plays on every tab.
- Tab pages (Stats, Friends, Group) use the canvas page layout of Settings/Collection, with a top bar holding only the theme toggle.

### 6.8 HUD Counters (economy)
- Left side of Home's top bar, only with `features.economy`; hidden on Focus with the rest of the top bar (and absent from Break, Settings, Collection and tab pages).
- `hud-counter`: 40px tall pill (`--radius-full`), canvas fill, 1px `--color-hairline` border (like `button-icon-circular`), padding 0 `--space-md`, `--space-xs` gap, 20px icon then `body-sm-strong` tabular number. Two of them, `--space-sm` apart: **gold** (a button) and **unicorns** (count of Unicorns on the island; display only).
- The gold number shows the gold the user has been told about. When it rises (a departure notice was shown), it counts up over 1s, starting 0.6s later so the first coins have landed; spending makes it jump. Reduced motion: it jumps.
- With `features.cosmetics` tapping gold opens the Shop (7.7); its accessible name is `N gold. Open shop`.
- Without it, tapping gold toggles a `gold-info` bubble below it: canvas, `--radius-md`, Level 2, padding `--space-md`, max width 260px, `body-sm` text `Animals leave gold when they move on after 7 days. You will spend it in the shop.` Any tap elsewhere or Esc closes it. The button has `aria-expanded`.

---

## 7. Screens

### 7.1 Home
- Background: Part II scene (sky + island), full-bleed.
- Top bar.
- Bottom-center `panel`: `eyebrow` `25 MIN FOCUS · 5 MIN BREAK`, `button-primary` `Start focus`. Above the tab bar when it is shown (6.7).
- The panel is the only interactive DOM area over the scene; everywhere else pointer drags rotate the island (see 13).

### 7.2 Focus
- Background `--color-primary`; island visible under `--color-overlay-focus`.
- Center: `timer` in white. Above it: `eyebrow` `FOCUS` in `--color-mute-soft`.
- Overtime: `badge-overtime` replaces the eyebrow; timer shows `+05:23`; `button-primary-inverse` `End focus` appears below.
- Hidden control: `button-hold` `Hold to stop`, shown at 50% opacity on pointer move / tap, fades after 3s.
- **Nothing else**: no top bar, tab bar, shadows, toasts, or modals.

### 7.2a Notice card (Inbox)
- Deferred news (departures, weekly results, war reports, …) is shown one at a time on Home and Break only, never on Focus.
- A `panel` at the top center, below the top bar (`--space-layout-xl` + `--space-lg` + safe area from the top), width `min(400px, 100% − 2 × gutter)`, `body-md` message and a `button-secondary` `OK` that dismisses it; the next notice follows.
- Enters with a `--motion-base` fade and an 8px downward settle; reduced motion: fade only. `role="status"` so screen readers announce it without stealing focus.

### 7.3 Break
- Background: Part II scene, bright.
- Reward: `card-tier` with `badge-tier`, name in `display-lg`, rotating voxel model inside. Level 2.
- No reward: `card-feature` with the neutral message.
- Below: `eyebrow` `BREAK`, `timer-sm`, `button-primary` `Start focus now`, `button-secondary` `Home`.
- **Layout.** Everything sits in one `panel` (max width 400px, so `timer-sm` fits on one line). Below 992px: bottom-center, full width minus gutters. From 992px: right-aligned (gutter `--space-3xl`) and vertically centered, so the island stays visible.
- **Reward card contents.** `badge-tier` (top), a 160px-tall transparent 3D preview with the model rotating slowly (one turn per 8s), the name in `display-lg`. The card fill follows the tier (2.4).
- **Reveal.** On entering Break the card fades in over `--motion-slow` (8px upward translate), the tier chime plays, and the model spins. After 3.5s, or when the card is tapped, the new animal appears on the island with a 300ms fade/scale-in from 0.6 to 1. The buttons are usable the whole time.
- **Break over.** The eyebrow `BREAK` is replaced by `Ready for the next one?` in `display-sm`, the timer is hidden, and `Start focus` becomes the primary button.
- **Reduced motion.** No spinning; the model is shown at a fixed 3/4 angle and the animal appears instantly.

### 7.4 Settings
- Canvas, `display-md` title, `settings-row`s grouped under `eyebrow` labels (`TIMER`, `SOUND`).
- `TIMER`: `Focus length` and `Break length` as `stepper`s in minutes (focus 5–60 step 5, break 1–30 step 1), with a `body-sm` `--color-body-mid` unit label `min`.
- `SOUND`: `Chimes` as a `toggle`.
- `STATS` (only with the Stats tab): `Week starts on` as a `segmented` control `Monday` / `Sunday` (default Monday).
- `DATA`: `Export data` and `Import data` rows, each with a `button-secondary` (`Export`, `Import…`). Picking a file shows a `card-feature` below the rows: `body-md` summary (`Backup from 7 Oct 2026: 12 sessions, 8 animals.`), `body-sm` `--color-body-mid` warning `This replaces all data on this device.`, then `button-primary` `Replace data` and `button-secondary` `Cancel`. An unreadable file shows a `body-sm` `--color-accent-red` line in the same place instead.
- Content is a single column, max width 560px, centered; changes save immediately (no save button).

### 7.5 Collection
- Canvas, `display-md` title, card grid (1 / 3 / 4-up).
- Collected: `card-tier`. Not collected: `card-feature` with silhouette and `???`.
- **Card contents.** A 96px pixel-art sprite of the animal (16.5; its equipped skin with cosmetics on), the name in `display-xs`, `badge-tier`, and a `caption` count `×3` when more than one is owned (all-time: departed animals still count). With the economy on, a second `caption` line `On island: 2` (0 when all have left). Silhouettes are solid `--color-mute-soft` shapes.
- **Stats strip** above the grid: three `card-feature`s (`FOCUS TIME` as `12 h 40 min`, `SESSIONS`, `ANIMALS` as `7 / 50`), each with an `eyebrow` label and a `display-sm` value. Stacked 1-up on Mobile, 3-up from Tablet.
- **With cosmetics** (`features.cosmetics`):
  - **Island theme** between the stats strip and the grid: `eyebrow` `ISLAND THEME`, then a row of owned themes (Default first), each a 96px-wide button with the 48px theme sprite and its name in `caption`; the equipped one has a 2px `--color-primary` outline and `aria-pressed`. A tap equips it and the island changes at once. With only Default owned, a `body-sm` `--color-body-mid` line `More themes in the shop.` follows it.
  - Collected cards are buttons that open the **species sheet** (the Day-detail `<dialog>`): `display-sm` name with its `badge-tier`, then one row per skin, Default first, then every skin of that species that is owned or for sale (sprite 48px, name `body-md-strong`). Right side: `Equipped` (`caption`, `--color-body-mid`) for the equipped one; `Equip` (`button-secondary`) for owned ones; for the rest the price (gold icon + number) and `Open shop` (`button-secondary`), which closes the sheet and opens the Shop. Equipping changes every animal of the species on the island at once.

### 7.6 Stats (tab)
- Canvas tab page (6.7), `display-md` title `Stats`, content max width 720px. Plain HTML/CSS bars, no chart library; every control is a real button (keyboard reachable). Durations read `0m`, `42m`, `1h 42m`, `2h 05m`.
- **Month selector**: `button-icon-circular` ← / → around the month name in `display-xs` (`October 2026`). → is disabled on the current month (no future months).
- **Overview** (`card-feature`): `eyebrow` `DAILY AVERAGE`, the figure in `display-lg` (`1h 42m`) followed by `body-md` `--color-body-mid` `/ day`. Below, three figures in a row (`eyebrow-sm` label over `display-xs` value): `TOTAL`, `ACTIVE DAYS`, `BEST DAY` (value plus a `caption` date, `—` when none). Then a strip with one bar per day of the month: 48px tall, bars `--color-primary` on a 2px `--color-hairline` floor, height scaled to the month's best day, future days left empty; `aria-hidden` (the figures carry the data).
- **Week** (below Overview, own `eyebrow` `WEEK`): the same ← / → navigation around the range in `display-xs` (`5 – 11 Oct`, `28 Sep – 4 Oct` across months; no future weeks), then `body-sm` `--color-body-mid` `Total 8h 20m · 1h 11m / day`. Below, a `card-feature` with 7 equal columns, one button per day (week starts per Settings, Monday by default): `eyebrow-sm` weekday (`MON`), `body-sm-strong` date, a 96px bar area (bar scaled to the week's best day, `--color-primary`, on a 2px hairline floor), `caption` time (`2h 05m`) and `caption` `--color-body-mid` count (`×4`). Today: `--color-primary` 2px outline (`--radius-sm`) around its column. Future days: text `--color-mute-soft`, no bar, not clickable. Clicking a day opens the Day detail (7.6, below).
- **Month** (between Overview and Week, `eyebrow` `MONTH`, follows the month selector): a `card-feature` (padding `--space-md`) with a 7-column grid: `eyebrow-sm` weekday initials, empty cells before day 1, then one button per day (`--radius-sm`, min height 64px) showing the date (`caption`), focus time (`caption`, compact `52m` / `1h38` so it fits a phone-width cell, `—` when none) and count (`caption`, `×3`). Background by focus minutes in 5 steps from existing tokens: 0 `--color-canvas` with 1px hairline; ≥1 min `--color-hairline`; ≥30 `--color-mute-soft`; ≥60 `--color-body-mid` with white text; ≥120 `--color-primary` with white text (thresholds `config.ui.heatMinutes`). Text is always present, so color is never the only signal. Today: 2px `--color-primary` inset ring (white ring on the two darkest steps). Future days: `--color-mute-soft` text, no fill, not clickable. Clicking a day opens the Day detail.
- **Day detail** (native modal `<dialog>`: focus stays inside, Esc or the close button dismisses, backdrop `--color-backdrop`): `modal` surface, width `min(480px, 100% − 2 × gutter)`, max height 80% with its own scroll; bottom-aligned on Mobile, centered from Tablet. Header: `display-sm` date (`Wednesday 7 October`) with the close icon button, then `body-sm` `--color-body-mid` summary (`1h 40m · 2 sessions`, counted sessions only). One row per session, oldest first, separated by hairlines: start time (`body-md-strong`, `09:12`), length `body-sm` (`32m`, with `+7m overtime` when it ran past the plan), and on the right the 48px reward sprite with a `badge-tier`, or nothing. Abandoned sessions: whole row `--color-mute`, length replaced by `Stopped after 9m`, no sprite. Empty day: `body-md` `No sessions.` Opens with a `--motion-base` fade (no movement with reduced motion).

### 7.7 Shop (cosmetics)
- A page of the Island tab like Collection, opened by tapping the gold counter (Home only; never on Focus). Top bar: the gold counter (display only) on the left, close on the right. `display-md` title `Shop`, content max width 1120px.
- **Featured**: `eyebrow` `FEATURED · <release name>` over one row of item cards from the newest release that has started; the row scrolls sideways on phones.
- **Sections** (`display-xs` headings): `Animal skins` (only species the user has earned at least once, by catalog order), `Island themes`, `Decorations & buildings` with `eyebrow-sm` sub-headings per category (`Structures`, `Nature`, `Lights`, `Decorations`). Items not for sale (not purchasable, outside their window, retired, too new for the app) are not shown.
- **Item card** (`card-feature`, centered, like a Collection card): the 96px sprite (16.5), name `body-md-strong`, a row of badges, the price (`gold` icon + `body-sm-strong` number), then one button:
  - `Buy` (`button-secondary`), or `Owned` (disabled) for skins and themes already owned; buildings can always be bought again and show `Owned ×2` as a `caption`.
  - When the balance is short: disabled, `Need 12 more`.
  - Badges: `New` (`badge-info`) for items whose release started in the last 14 days (`balance.shop.newBadgeDays`); `Leaves in 3d` (`badge-overtime` colors) for limited items (`Leaves in 5h` under a day).
- Grid: 2 columns on phones, 3 from 768px, 4 from 992px; `--space-md` gaps; sprites stay 96px.
- **Buy** opens a confirm sheet (the Day-detail `<dialog>`): `display-sm` `Buy Golden Fox?`, a 180px preview that turns slowly (skins and buildings: the model; themes: a small island in the theme; static with reduced motion), `body-md` `45 gold · you have 208`, buttons `Cancel` (secondary) and `Buy` (primary). On success the sheet says `It's yours.`; for a skin or theme it offers `Equip` (primary) and `Done`; for a building `Place it in build mode.` and `Done`. A failed write shows `Could not buy. Try again.` and changes nothing.

### 7.8 Build mode (cosmetics)
- Entered from the `build` icon on Home (never Focus or Break). The island stays interactive like Home (drag to rotate within ±30°, wheel to zoom); the Home panel, HUD and notices are hidden. Top bar: `display-xs` `Build` on the left, `Done` (`button-secondary`) on the right. Esc or Done returns Home.
- **Tray** (bottom `panel`, like the Home panel, max width 560px): `eyebrow` `YOUR BUILDINGS`, then a sideways-scrolling row of owned, unplaced buildings: 88px-wide buttons with the 48px sprite, the name (`caption`) and `×2` when more than one. Empty: `body-sm` `Nothing to place. Buy decorations in the shop.` and `Open shop` (`button-secondary`).
- **Placing** (after picking one from the tray, or Move): a see-through copy of the building (60% opacity) stands on the chosen tiles over the footprint tint (15.7): green when it fits, red when not. It starts on the free tile nearest the camp that fits. Desktop: it follows the pointer; a click on a tile moves it there. Touch: a tap moves it. Arrow keys move it one tile. The panel shows the reason when it does not fit (`body-sm`, `Leave room for your animals`, `The ground is not flat`, …) and `Rotate` (or R), `Cancel` and `Place` (primary, disabled when red; Enter). Animals standing on the tiles walk to the nearest free tile when it is placed.
- **A placed building**: tapping it (when not placing) outlines its tiles in white and the panel offers `Move`, `Rotate` (in place, only if it still fits), `Store` (back to the tray) and `Cancel`.

---

## 8. UI Motion

| Token | Duration | Usage |
|---|---|---|
| `--motion-fast` | 150ms | Press, hover |
| `--motion-base` | 300ms | Panel open/close, control fade |
| `--motion-slow` | 600ms | Screen transitions |
| `--motion-scene` | 1000ms | Overlay fade into Focus (synced with camera, see 15.3) |

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Fades and short translates (≤ 8px) only. No bounces or scale pops.
- Focus screen: no animation except timer digits changing.
- `prefers-reduced-motion`: fades only.

---

## 9. Sound

- Soft, short (< 1.5s), non-alarming. No looping alarms.
- Focus end: gentle chime. Break end: lighter, different chime.
- Reward reveal: tier-dependent, more distinct for higher tiers.
- Master toggle in Settings; moderate default volume.

---

## 10. Copy

- Calm, short, encouraging. Never guilt-tripping.

| Situation | Text |
|---|---|
| Start | `Start focus` |
| Overtime | `OVERTIME` + `+05:23` |
| End focus | `End focus` |
| No reward (< 25 min) | `Nice work. Focus for 25 minutes or more to meet a new friend.` |
| Abandon | `Hold to stop` |
| Break over | `Ready for the next one?` |

- All strings live in `src/ui/strings.ts`.

---

## 11. Accessibility

- Text contrast ≥ 4.5:1 (check `--color-mute-soft` on `--color-primary` and white on every tier fill).
- Keyboard: `Space` = primary action, hold `Esc` = abandon.
- Focus ring: 2px `--color-primary` (light) or white (dark), 2px offset.
- Tier never conveyed by color alone.

---

## 12. UI Do's and Don'ts

**Do**
- Near-black primary buttons on light surfaces; white (polarity flip) on dark.
- Accents only for tier fills, badges, and the abandon ring.
- 4px buttons, 8px cards.
- Level 2 layered shadows for panels over the island.
- Uppercase eyebrows to mark sections.

**Don't**
- Weights above 600 or below 400.
- Accent-colored buttons, pill buttons, UI gradients, new accent colors.
- Shadows, toasts, or modals on Focus.

---

# Part II — Rendering

## 13. Scene and Camera

- One persistent `<Canvas>` shared by Home, Focus, and Break (never remounted between them).
- **Orthographic camera**, isometric angle: azimuth 45°, elevation ≈ 35.26°.
- Island centered; zoom fits the island's top surface (plus 35% of the underside, which may crop at the bottom edge) with a 5% margin, recalculated when the island grows. This shows blocks about 2x larger than fitting the whole floating island; larger islands make the camera pull back to keep the top surface in view.
- Home: limited rotation/zoom `[ASSUMPTION]`. Focus and Break: camera fixed.
- Renderer: antialias on, `outputColorSpace = SRGBColorSpace`, pixel ratio capped at 2.

## 14. World Palette

Defined in `src/world/palette.ts`. Not shared with UI tokens.

### 14.1 Sky

| Token | Value |
|---|---|
| `sky-top` | `#9FD8FF` |
| `sky-bottom` | `#EAF6FF` |
| `cloud` | `#FFFFFF` (opacity 0.9) |

### 14.2 Blocks

| Block | Top | Side |
|---|---|---|
| Grass | `#7BC950` | `#5FA83E` edge over dirt |
| Dirt | `#9B6B43` | `#86593A` |
| Stone | `#8A8F98` | `#747983` |

Terrain, water and camp colors are one keyed record, `defaultBlocks` (`grassTop`, `grassSide`, `dirtTop`, `dirtSide`, `stoneTop`, `stoneSide`, `water`, `waterStreak`, `cabinLog`, `cabinLogDark`, `cabinBeam`, `cabinRoof`, `cabinRoofDark`, `campStone`, `campStoneDark`, `firewood`; keys in `shared/content/palette.ts`). A block theme replaces this record.

### 14.3 Water

| Token | Value |
|---|---|
| `water` | `#4FA8E8` (opaque) |
| `water-streak` | `#9AD4FF` (flow streaks) |
| `splash` | `#FFFFFF` |

### 14.4 Gold

| Token | Value |
|---|---|
| `coin` | `#F2C230` (lit like blocks, so faces shade) |
| `coin-dark` | `#D9A21E` (checkered with `coin` in the pile) |
| `puff` | `#EEEEEE` (departure puff) |

## 15. Island

### 15.1 Structure
```
[ Top ]        Grass (animal tiles)
[ Layer 1 ]    Dirt
[ Layer 2..N ] Stone/dirt, narrowing downward with random gaps
```
- The underside is an inverted pyramid: the center column is about `coneSlope × half-width` layers deep (`config.island.coneSlope`), depth follows the smooth radius so the tip stays visible below the rim.
- 1 unit = 1 block.
- **Outline**: near-circular (Euclidean distance plus a small seeded jitter), 7×7 at the start.
- **Heights**: each surface tile is level 1–3 and one level is **0.5 block** tall (surface at 0.5 / 1.0 / 1.5 above the base plane). Level 1 is one full block; each extra level adds a half-height slab (grass on top, dirt below).
- **Terrain shape**: domain-warped fractal noise plus a weak tilt that raises the back (`-x`, `-z`) and lowers the front. Heights are terraced: a wide middle band is level 2 (plains), with level 3 hills and level 1 lowlands as smaller patches. Terrain is blended flat (level 2) around the camp, so hills never enclose the hut.
- One `InstancedMesh` per block type.
- Pixel-art textures (low resolution, `NearestFilter`) or flat colors.
- Shape rules (size, seed, growth) are defined in `ARCHITECTURE.md`.

### 15.2 Clouds
- 3–6 low-poly voxel clouds drifting slowly behind the island (Home and Break only). Unlit flat `cloud` color at 0.9 opacity, built from overlapping boxes at 55% scale.

### 15.3 Render Modes

| Screen | Mode |
|---|---|
| Home | Full: 60fps, all animations, clouds, interaction |
| Focus | Dimmed: fixed camera, animals slowed or paused `[ASSUMPTION]`, no clouds, frame rate capped (20–30fps) or on-demand |
| Break | Full, camera fixed, reward reveal plays |
| Settings, Collection, Stats, Friends, Group pages | Paused: the canvas stays mounted but renders no frames |

- Home → Focus: camera pulls back slightly over `--motion-scene` (1000ms) while the UI overlay fades in and the sky gradient fades out, so the dimmed island sits on the near-black `--color-primary` background.
- The island keeps clear of floating panels: the camera fits it into the screen area not covered by the Home panel (bottom) or the Break panel (right from 992px, bottom below).
- New animals are added to the scene only when the Break reveal plays.

### 15.4 Night Mode and Camp

- Theme is `light` (default, unchanged look) or `dark` (night), stored in settings and toggled from the top bar. It affects the world and the Focus overlay; UI surfaces keep their tokens.
- **Night sky**: gradient `#070B24` to `#1F2C5C` with ~40 small white stars, cross-fading with the day sky over `--motion-scene`. Clouds turn dim blue-grey at 35% opacity. Ambient light becomes cool blue (`#7F8FD8`, 0.32) and the directional light a faint moonlight (`#93A8FF`, 0.28). Lighting blends over about 1s.
- **Camp**: the island always has a campfire on the center tile and a small hut (1 tile) two tiles from it along `-x` (one empty block between them), its door facing `+x`, toward the campfire. Both tiles are reserved: animals are never placed on them, and both sit at terrain level 2.
  - **Hut**: a forest log cabin about 1.5 blocks wide (1.3 × 1.0 body on a stone foundation, so it overhangs its tile slightly; the terrain around it is flat). Walls are stacked horizontal logs alternating two browns (`#B98552` / `#9A6A3E`) with dark corner posts (`#5E3B20`); the roof is a stepped wooden-plank gable (`#8A5A36` / `#6F4528`, ridge along x, overhanging eaves, ridge cap); a stone chimney (`#9A9DA3`, dark cap) rises above the roof on the back side. The gable end faces +x with a framed door and a stone step; a framed window on the +z wall.
  - Day: the fire is a cold pit (three logs), the door and window are dark.
  - Night: flames (three stacked flickering boxes in orange/yellow/pale yellow), a warm point light (`#FF9A3C`) with gentle flicker, an additive radial glow on the ground (about 4 blocks wide), a warm glowing door and window, and three soft grey smoke cubes rising from the chimney in a loop.
- **Focus routines** (animals are 0.25x, see 16.2), triggered when the phase becomes `focus`, each animal starting after a random 0-0.8s delay, walking in a straight line and turning to face its direction with a small hop stride:
  - Day: every animal runs to the hut door, shrinks over 0.25s and disappears inside.
  - Night: animals walk to spots on the blocks nearest the hut (up to 3 per block), then lie on their side and breathe slowly (about 3.5% body scale, ~3s period).
  - Leaving Focus (Break or reload into Break): animals reappear at the door (day) or stand up (night) and walk back to their tiles. Reloading while in Focus shows the end state immediately. With reduced motion all of this snaps with no walking.

### 15.6 Coin Pile

- On the reserved camp tile next to the cabin (camera side, `(-2, 1)`), only with the economy on. It shows a bucket of the gold balance, never the exact amount: levels 1–6 from `balance.economy.pileThresholds` (1, 10, 30, 100, 300, 1000 gold), nothing at 0.
- A round heap of 0.12-block gold voxels on a 7×7 grid (one instanced mesh, never one mesh per coin), checkered `coin` / `coin-dark` so the voxels read. Center height 1, 2, 3, 4, 5, 6 voxels by level, falling off by one voxel per grid step.
- The level follows the gold the user has been told about: departure gold joins the pile when its notice shows (coins land there, see 18).
- Night: the pile is lit by the campfire like every block plus a faint warm glow (emissive 30% of `coin`, following the day/night blend) so it catches the firelight, and 3 tiny white sparkles twinkle on its top voxels. No sparkles on Focus or with reduced motion.

### 15.7 Block Themes and Buildings

- A block theme replaces the terrain, water and camp colors (14.2 keys) and may tint the clouds (`cloudTint`) and add ambient particles (18, presets) that drift over the island on Home and Break only. The island's shape never changes with the theme.
- Buildings and decorations are voxel models at **1/8 block per voxel**: a 1×1 footprint is 8 voxels wide, a 3×3 one 24. They stand on the surface of their tiles (all at one height) and turn in 90° steps.
- Footprint tint (build mode, Content Studio): flat squares 0.94 block wide on each covered tile, `build-ok` `#5ED67A` when the building fits, `build-bad` `#FF5A5F` when not, 45% opacity.

### 15.5 Stream

- One winding stream per island (deterministic from the seed). It starts about 2.3 tiles from the center on the back side of a chord, crosses the front half of the island (downhill on average) and leaves through the rim. It never touches the campfire or hut (at least 1.5 tiles away).
- **Path**: the best of many wobbling chords (angle, lateral offset, meander phase): no tile is cut below its natural level, it stays clear of the camp, is at least 5 tiles long on the smallest island, and prefers bends and one or two level steps. The tile path is corner-cut twice so bends are rounded, not right-angled.
- **Terrain is replaced, not reshaped**: a stream tile keeps the natural level of that tile (water never flows uphill, so a tile is only lowered to the level upstream when the terrain rises). Neighbor tiles are untouched: no raised banks, no clamping.
- **Bed and banks**: the tile's top block is cut down 0.25 block (dirt bed); the water surface sits 0.12 block above the bed. The water is an opaque ribbon 0.7 block wide, narrowing slightly where a bend is too tight for its width so it never folds over itself. Everything in the tile that is not water is filled with grass at the surrounding tile height by a smooth bank mesh: the channel is cut out along the curved ribbon edge (no voxel steps, no square notch), with a wall down to the bed that has a thin grassy lip on top and dirt below. The stream ends at the first rim tile it reaches (at least 4 tiles in): it falls straight ahead if that side is open, otherwise it turns once, like any other bend, toward the most outward open side. The bank reaches 0.03 block under the water edge so no bed shows between them. Where a bed tile's side is exposed (island rim or a lower neighbor), the bank continues down that side to the bed block (grassy lip over dirt), so it never reads as a thin floating sheet.
- **Spring**: the ribbon starts with a round head at the first tile, and water bursts up from it: about 22 white cubes (0.06–0.10 block) shoot up in all directions (2–3.4 blocks/s, up to ~1 block high), fall back into the pool and shrink (~1.1s life, repeating).
- **Falls**: at every level step the water leaves the lip on a horizontal tangent and curves down in a parabola (steepening to ~75°), then rounds out onto the lower bed. Where the stream reaches the island rim it falls outward, over the missing neighbor that points away from the center (never along the boundary), 2.5 blocks, and dissolves into mist.
- **Splash**: white voxel cubes (`splash`, 0.05–0.09 block) burst up and outward from every landing point, fall back and shrink, repeating (~0.8s life, 12 per fall).
- **Flow**: the water carries lighter streaks (`water-streak`) that scroll downstream (about 0.6 block/s). Focus slows this by `focusAnimalTimeScale`.
- **Reduced motion**: streaks and splash are static.
- Animals are never placed on water tiles (they are excluded from placement and from night sleeping spots).
- When no free tile is left (buildings fill the island), animals share a tile, up to 4, each standing in its own corner (0.22 block from the center) instead of in the middle.

## 16. Voxel Models

### 16.1 Format
```ts
// src/assets/voxels/<animalId>.ts
export const chick: VoxelModel = {
  size: [4, 5, 4],
  keys: { 1: 'body', 2: 'beak', 3: 'eye' },                        // palette index → named key
  palette: { body: '#FFD93D', beak: '#FF8C42', eye: '#1E1E1E' },   // the species' default colors
  voxels: [ /* [x, y, z, paletteIndex] */ ],
};
```
- Voxels are painted by **named key** (`body`, `belly`, `muzzle`, `accent`…, `eye`, `nose`, `beak`, `horn`, `wing`, …; list in `shared/content/palette.ts`), so a skin recolors a model by key. `eye` is always the `#1E1E1E` ink key.
- Converted at runtime into one merged `BufferGeometry` per model with hidden faces culled and vertex colors.
- Geometry is built once per species and cached; each placed animal reuses it.

### 16.2 Scale
- Animal model voxel = **1/6 block** in model space. On the island, animals are drawn at **0.25x** (world voxel = 1/24 block), so a 6-voxel-wide animal is about 1/4 of a block wide; smaller and larger species keep their relative sizes. The Break reward card shows the model at full size.
- Height by tier: Common 3–5 voxels, Mythic 5–7, Epic 7–10, Legendary 10–12.
- Width is at most 6 voxels. Depth is at most 6, or 8 for Epic and Legendary so bulky animals (Tiger, Bear, Horse, Cow) get a longer body (ADR-025).

### 16.3 Style
- Max 6 palette colors per animal (Legendary up to 8).
- Flat colors, no textures on animals.
- Eyes: 1 voxel `#1E1E1E`, optional 1-voxel highlight.
- Rounded silhouettes from stepped voxels; avoid thin 1-voxel limbs.
- Models face `+Z`, origin at bottom center.

### 16.4 Budgets
- Animal models and skin overlays ≤ 16×16×16 voxels and ≤ 800 voxels. Buildings: 1/8-block voxels (8 per footprint tile), footprint ≤ 3×3, height ≤ 24, ≤ 3,000 voxels (docs/CONTENT.md).

### 16.5 Sprites
- Collection, Day detail and Shop pictures are generated sprites (§9 Q33): each item rendered with the island's isometric orthographic camera (azimuth 45°, elevation 35.26°) and lighting, fit to a 48×48 px frame with an 8% margin, no antialiasing, fully opaque or transparent pixels. Flat shading keeps them to the model palette in three face shades. Shown at 2× (96 px cards) or 1× (48 px rows), nearest-neighbor.
- Not collected: the same sprite as a flat `mute-soft` (#ababab) silhouette.
- Block theme swatch: a 3×3 patch of grass blocks in the theme's colors with water in the middle.

## 17. Lighting and Materials

- One directional light from top-left, one soft ambient light.
- `MeshLambertMaterial` with vertex colors, flat shading.
- Face brightness: top lightest, left medium, right darkest.
- No real-time shadows `[ASSUMPTION]`; soft blob shadow (transparent circle) under each animal.

## 18. World Motion

- Island bobbing: 4–6s cycle, amplitude ≤ 0.15 block.
- Animal idle: turn in place, short hop, move one tile; randomized intervals 3–8s.
- **Poke:** clicking an animal (Home and Break only, never Focus) cancels its current idle action, shows a white voxel speech bubble with a dark `!` (`#1E1E1E`) above its head for 1.2s, and immediately plays exactly one idle action (turn, hop, shuffle, or flop for the fish). The bubble faces the camera and follows hops. Reduced motion: bubble only, no action.
  - With the economy on, the bubble shows the animal's time left instead of `!`: a white label (rounded corners, `#1E1E1E` bold sans text, same height as the `!` bubble, as wide as the text) reading `7d left` (whole days, rounded, from 36 hours), `20h left` (under 36 hours) or `<1h left`. Unicorns never expire and keep the `!`.
- **Fish:** flops in place (squash-and-stretch hop, side tilt every 2–4s).
- **Butterfly (`flutter`):** flat design. The model is a 2-wide body plus flat wings spread in the horizontal plane (the isometric camera sees it from above). In the world the wings are separate meshes hinged at the body: they flap continuously (about 3 Hz, angle 0.15 to 0.85 rad, folded up when asleep) while the butterfly flies 0.6 block above the ground along random waypoints within 1.2 tiles of its tile (0.8 blocks/s, facing its heading, altitude bobbing), its blob shadow staying on the ground. Poke: new waypoint at once and faster flapping for 1.2s. Focus slows it by `focusAnimalTimeScale` like every animal. Reduced motion: wings static at 0.3 rad, no wandering. The Break card and Collection show the rest pose (wings flat).
- **Legendary (Unicorn, Tiger):** sparkle particles (max 8), shared by every Legendary species. The unicorn also has a rainbow mane and, every 2 to 5 seconds, a rainbow burst (`rainbow` idle): 14 small cubes in the rainbow colors (`#FF5A5F`, `#FFA24D`, `#FFE14D`, `#5ED67A`, `#4DA6FF`, `#8E6BFF`, `#FF8AD8`) pop out around its body, arc up and fall back while shrinking over about 0.9s. Slowed by `focusAnimalTimeScale` like every animal; none with reduced motion. Gradients allowed here only.
- **Species added in ADR-023** follow 16.2 to 16.3 unchanged (same tier heights, at most 6 wide and deep, palette budget). Models are symmetric where possible (`boxM`) and keep limbs, wings and tails as separate voxel groups so the idle hop, turn and shuffle read well. The Tiger is orange with black stripes, a white muzzle and a forehead `王` mark (palette: orange, `#1E1E1E`, white, pink nose).
- **Departure** (F3, guidance_v2 Step 2.3; neutral, no farewell): animals named in a queued `animals_departed` notice stay on their tiles until that notice is shown on Home or Break. Then, 0.12s apart, each one shrinks to nothing over 0.3s while a puff of 6 `puff` cubes (0.09 block) bursts outward and shrinks away over 0.6s, and one `coin` (a flat gold voxel 0.16 × 0.064 × 0.16 block, spinning) arcs from its tile into the coin pile (0.7s, peak 1.2 blocks up); the HUD gold counter counts up (6.5). At most 10 animate; the rest vanish at once and the pile throws one combined burst of 8 coins that pop up and fall back (0.8s). Never in Focus. Reduced motion: animals vanish, no puffs, arcs or bursts; the counter jumps.
- **Behavior presets** (guidance_v2 Step 3.2; code in `world/presets/`, ids in `content/presets.json`). Content picks them by id:
  - Idle sets: `default`, `flop`, `flutter`, `sparkle`, `rainbow` (above).
  - Part animations, on a named model part turning around its pivot: `spin` (one turn per 4s around the part's forward axis), `sway` (±0.08 rad, 2.5s), `bob` (±0.05 block, 2s), `flap` (±0.5 rad, 3 Hz). Several copies of one building are out of step.
  - Particle fields, small unlit cubes drifting through a box, each fading in and out over its life: `smoke` (6 grey, rising and growing), `leaves` (22 orange/red/yellow, falling with a sway), `petals` (24 pink/white), `snow` (40 white, slow fall), `fireflies` (12 yellow-green, wandering and blinking, night only). None with reduced motion.
  - Lights: `lantern_glow`, a warm `#FFC266` halo (0.9 block) that fades in with night. A glow sprite, not a real light, so any number is cheap. A building with a light draws its `flame` and `glass` voxels unlit, so the lamp itself reads as lit by day and night.
- `prefers-reduced-motion`: disable bobbing, idle hops, and camera moves.

## 19. Performance

- Home: 60fps with 100 animals on a mid-range laptop.
- Focus: minimal GPU usage (see 15.3).
- Dispose geometries/materials on unmount; no per-frame allocations in render loops.
