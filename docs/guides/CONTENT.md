# CONTENT.md

How to add animals, skins, island themes and decorations. Content is data (ADR-041, ADR-045): every item is its own file (animals and buildings: their own folder with the model next to it). Adding one never touches game code, unless it needs a new behavior preset.

## 0. Quick recipes

`npm run content:new` creates the files from a template in the right place (it never overwrites). Then edit them, check them in the Studio (`npm run dev`, open `/studio`), run `npm run content:sprites` and `npm run content:validate`, and commit.

| To add | Command | Then edit |
|---|---|---|
| An animal | `npm run content:new -- animal quokka --tier mythic --en Quokka --ko 쿼카` | `animals/quokka/model.ts` (the shape; a placeholder until you draw it) |
| A skin for one animal | `npm run content:new -- skin fox arctic-fox --en "Arctic Fox" --ko "북극여우"` | `animals/fox/skins/arctic-fox.json`: `palette` (starts as the fox's own colors), `price` |
| A skin style for every animal | `npm run content:new -- family neon` | `skin-families/neon.json`: `transform`, `priceByTierRank` |
| An island theme | `npm run content:new -- theme lava` | `themes/lava.json`: the 16 colors (start: Meadow), `ambient` particles |
| A decoration or building | `npm run content:new -- building bench --size 2x1` | `buildings/bench/model.ts` (shape), `building.json` (`category`, `price`) |
| A release (a drop of new items) | `npm run content:new -- release nov-2026 --date 2026-11-01` | `releases/nov-2026.json`: `featured` ids; give new items `"release": "nov-2026"` |

Options: `--en`, `--ko` (names; Korean defaults to the English name, translate it), `--release <id>` (default: the newest release), `--price <gold>`. New animals join the reward pool of their tier at once and get skins of every family automatically.

## 1. Where things live

| Path | What |
|---|---|
| `content/animals/<id>/animal.json` | One animal (`kind: species`): names, `tierRank` 0–3, `idle` preset, `model: animals/<id>` |
| `content/animals/<id>/model.ts` | Its voxel model (builder, or `model.vox` → `model.json` from MagicaVoxel) |
| `content/animals/<id>/skins/<skinId>.json` | Handcrafted skins of that animal (`kind: animalSkin`) |
| `content/skin-families/<id>.json` | Skin families, expanded to one skin per animal (`family:speciesId`) |
| `content/themes/<id>.json` | Island block themes (`default` = the free Meadow) |
| `content/buildings/<id>/building.json` + `model.ts` | Buildings and decorations, model next to the data |
| `content/releases/<id>.json` | One file per release: date, name, featured items |
| `content/models/` | Loose models no item folder owns (e.g. skin overlays), and `palette-template.vox` |
| `content/presets.json` | Behavior preset ids the app implements (code: `src/world/presets/`) |
| `content/pack.json` | `contentVersion` of the bundled pack |
| `content/sprites/` | Generated sprite atlas (`npm run content:sprites`) |

The folder or file name is the item id; validation fails if they differ (and a skin in `animals/fox/skins/` must have `speciesId: fox`). Order in the Collection: by tier, then id; in the shop and pickers: by release date, then id.

Schemas: `shared/content/schema.ts`. Every item has `id`, `name: { en, ko }`, `purchasable`, `release` and optional `price`, `availableFrom`, `availableUntil` (exclusive), `minClientVersion`, `tags`. A model is referenced as `<group>/<id>`: an item folder's own model (`animals/fox`, `buildings/windmill`) or a loose model's path under `content/models/` without extension (`overlays/party-hat`).

## 2. Palette keys

Models never store raw colors in their shape: every voxel is painted with a **palette key**, and the model carries a default color per key. Skins and themes recolor by key.

- Animal keys: `body`, `body2`, `belly`, `muzzle`, `accent`, `accent2`, `accent3`, `eye` (always the `#1E1E1E` ink), `nose`, `beak`, `horn`, `wing`, `shell`, `mane`, `prop`, `prop2`, `rainbow1`–`rainbow5`.
- Building keys: `wood`, `woodDark`, `roof`, `stone`, `stoneDark`, `metal`, `leaf`, `leafDark`, `flower`, `flower2`, `cloth`, `cloth2`, `glass`, `flame`, `water`.
- Block theme keys: `grassTop`, `grassSide`, `dirtTop`, `dirtSide`, `stoneTop`, `stoneSide`, `water`, `waterStreak`, `cabinLog`, `cabinLogDark`, `cabinBeam`, `cabinRoof`, `cabinRoofDark`, `campStone`, `campStoneDark`, `firewood`.

The list is `shared/content/palette.ts`. Adding a key is a code change.

## 3. Authoring a model

Both paths produce the same model JSON (`{ size, keys, palette, voxels, parts? }`, canonical order), so the renderer never knows which was used.

### 3.1 MagicaVoxel (organic shapes: animals, skin overlays, statues)

1. Open `content/models/palette-template.vox`. Its palette reserves one index per palette key (table below); the swatch row shows them in order. Set each color you use to the key's default color.
2. Model with those indices only. Index 255 (magenta) is the **pivot marker**.
3. Movable parts: put each one in its own object (or layer) and name it (`blade`, `wing_L`, …). Place exactly one pivot voxel (index 255) inside each part where it should turn; it is not drawn. The unnamed object (or one named `main`) is the body.
4. Orientation: MagicaVoxel is z-up. The model's front (+Z in Sift) is **+y** in MagicaVoxel.
5. Save as the item's `model.vox` (`content/animals/<id>/model.vox`, delete the placeholder `model.ts`) or as a loose model `content/models/<group>/<id>.vox`, then run `npm run content:vox`. It writes `model.json` (or `<id>.json`) next to the file. It fails, naming the file, on: a palette index that is not a key, a part without a pivot, a pivot outside a part, an empty model. Commit both files.

`npm run content:vox -- --template` regenerates the template.

| Index | Key | Index | Key | Index | Key |
|---|---|---|---|---|---|
| 1 | body | 13 | shell | 25 | stone |
| 2 | body2 | 14 | mane | 26 | stoneDark |
| 3 | belly | 15 | prop | 27 | metal |
| 4 | muzzle | 16 | prop2 | 28 | leaf |
| 5 | accent | 17 | rainbow1 | 29 | leafDark |
| 6 | accent2 | 18 | rainbow2 | 30 | flower |
| 7 | accent3 | 19 | rainbow3 | 31 | flower2 |
| 8 | eye | 20 | rainbow4 | 32 | cloth |
| 9 | nose | 21 | rainbow5 | 33 | cloth2 |
| 10 | beak | 22 | wood | 34 | glass |
| 11 | horn | 23 | woodDark | 35 | flame |
| 12 | wing | 24 | roof | 36 | water |
| | | | | 255 | pivot marker |

### 3.2 Builders (code-drawn shapes)

Animals use `defineModel` (`tools/content-build/animal.ts`): a palette of `index: [key, default color]` and boxes painted by index, with mirror helpers (`boxM`, `setM`). Every existing animal's `model.ts` is an example; the rules (DESIGN.md 16) are checked by `src/domain/content/animals.test.ts`: width ≤ 6, depth ≤ 6 (8 for Epic and Legendary), height by tier (Common 3–5, Mythic 5–7, Epic 7–10, Legendary 10–12), ≤ 6 colors (Legendary 8), an `eye` of `#1E1E1E`. A `flutter` animal is drawn in its rest pose with the body in the two center columns and flat wings on both sides.

Decorations use the DSL (`tools/content-build/dsl.ts`): the item's `model.ts` (or a loose `content/models/<group>/<id>.ts`) default-exports a model:

```ts
import { model } from '../../../tools/content-build/dsl';

export default model([5, 8, 5], { stone: '#9A9DA3', wood: '#B98552' }, (m) => {
  m.paint('stone');
  m.cylinder(2.5, 0, 2.5, 2.5, 3);   // center x, y, center z, radius, height
  m.paint('wood');
  m.mirrorX(() => m.box(0, 3, 2, 1, 4, 1));
  m.stairs(0, 0, 0, 2, 3, '+z');      // x, y, z, width, steps, direction
  m.part('blade', [2, 6, 4], () => { /* shapes of the part */ });
});
```

Coordinates are voxels: x right, y up, z toward the front. Shapes drawn later overwrite earlier ones; `erase` carves. `npm run content:build` evaluates every builder.

### 3.3 Scale and budgets

| | Voxel size | Limits |
|---|---|---|
| Animal model or skin overlay | 1/6 block (drawn at 0.25× on the island) | ≤ 16×16×16, ≤ 800 voxels |
| Building / decoration | 1/8 block: one footprint tile = 8 voxels | footprint ≤ 3×3 tiles, height ≤ 24 voxels, ≤ 3,000 voxels |

The footprint must match the model: `ceil(width / 8) = w` and `ceil(depth / 8) = d`. Rotation turns the model in 90° steps.

## 4. Items

- **Animal** (`animals/<id>/animal.json`, `kind: species`): `tierRank` (0 Common, 1 Mythic, 2 Epic, 3 Legendary), `idle` preset (`default`, `flop`, `flutter`, `sparkle`, `rainbow`), `model` (`animals/<id>`). Animals are earned, never sold: no price.
- **Skin family** (`skin-families/<id>.json`): a `transform` (`hueShift`, `saturation`, `lightness: { offset, scale }`, `tint: { color, amount }`, `fixed` colors per key, `keep` keys; `eye` is kept by default) applied to every species' default palette, `priceByTierRank`, and optional `overrides[speciesId]` (`palette`, `overlay`, `price`). It becomes one skin per species, id `family:speciesId`.
- **Handcrafted skin** (`animals/<speciesId>/skins/<id>.json`): `speciesId`, `palette` (only keys the species model uses), optional `overlay` model.
- **Block theme** (`themes/<id>.json`): all 16 block keys, optional `cloudTint`, optional `ambient` particle preset, optional `tileTints` (2–12 colors banded diagonally over the top blocks; use a near-white `grassTop` so they show) and `finish: "glossy"` (shiny glass/metal blocks).
- **Building** (`buildings/<id>/building.json`): `category` (`decor`, `structure`, `nature`, `light`; `special` is never sold), `footprint`, `model`, `rotatable`, optional `allowOnWater` (footbridge), `parts: [{ name, preset }]` (part animations, the model must have the part), `light` (light preset).
- **Release** (`releases/<id>.json`): `date` (drives the shop's New badge for 14 days), `name`, `featured` item ids (the shop's Featured row while it is the newest release).
- Prices must sit in `balance.prices`: family skins 25–60, handcrafted skins 60–80, themes 120–200, buildings 10–80. Non-purchasable items (default theme, Champion Flag) have no price.
- Limited items: `availableFrom` / `availableUntil` (exclusive, ISO dates). Items that need a newer renderer or preset: `minClientVersion` (older apps hide them).

## 5. Presets

Visual behavior is code, picked by id (list in `content/presets.json`, code in `src/world/presets/`): idle sets (`default`, `flop`, `flutter`, `sparkle`, `rainbow`), part animations (`spin`, `sway`, `bob`, `flap`), particles (`smoke`, `leaves`, `petals`, `snow`, `glints`, `fireflies`, plus the animal effects `sparkle`, `rainbow`), lights (`lantern_glow`). An item that needs a new preset waits for an app release and sets `minClientVersion` to it.

## 6. Sprites

`npm run content:sprites` renders every species, skin, building and theme swatch in headless Chromium (same Playwright setup as `npm run e2e`, through the dev server's `/studio/sprites` page) with the island's isometric orthographic camera and lighting: 48×48 px, no antialiasing, alpha on/off, one atlas `content/sprites/atlas.png` + `atlas.json` (frame per item id with a hash of its inputs). Commit both. The Collection, Day detail and Shop show these sprites at 2×. The output is deterministic; `content:validate` reports missing sprites and sprites whose model or colors changed.

## 7. Release process

1. **Author**: `npm run content:new` (§0) creates the item files; draw the model (MagicaVoxel → `npm run content:vox`, or a builder) and fill in the JSON. New items name a release: create one (`npm run content:new -- release <id>`) for a new drop.
2. **Check in the Studio**: `npm run dev`, open `/studio`. Preview on sample terrains, day and night, every theme; tune family transforms on the 50-species grid; test building footprints. Edits save back to `content/`.
3. **Validate**: `npm run content:validate` (also in CI on every commit, and in `npm test`): schema, unique ids, references (species, models, presets, releases), palette keys, budgets, footprint vs model, both locales, prices, dates, sprites.
4. **Generate sprites**: `npm run content:sprites`, then validate again.
5. **Bump** `contentVersion` in `content/pack.json` and **build** the pack: `npm run content:build` → `dist-content/pack-<version>.json`. The app bundles the same pack.
6. **Publish** (from Phase 5, Step 5.8): upload the pack, verify on staging, then production. Until then content ships with an app release.
