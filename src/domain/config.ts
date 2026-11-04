/**
 * App tunables that only the client uses (rendering, UI, island shape). Gameplay numbers that the
 * server must reproduce live in `shared/balance/balance.ts`. `domain/` imports only itself and `shared/`.
 */
import { balance } from '../../shared/balance/balance';
import type { Tier, TierRank } from '../../shared/rules/tier';

export type { Tier };

/** Tier labels by rank, lowest to highest: Common, Mythic, Epic, Legendary (ADR-027). */
export const TIERS: readonly Tier[] = ['common', 'mythic', 'epic', 'legendary'];

export { TIER_RANKS, type TierRank } from '../../shared/rules/tier';
export const tierRank = (tier: Tier): TierRank => TIERS.indexOf(tier) as TierRank;
export const tierName = (rank: TierRank): Tier => TIERS[rank] as Tier;

export const DEFAULT_BLOCK_THEME = 'default';

export const config = {
  settings: {
    /** Timer limits are balance values (the server validates them too). */
    focusMinutes: balance.timer.focusMinutes,
    breakMinutes: balance.timer.breakMinutes,
    soundEnabled: true,
    weekStartsOn: 1 as 0 | 1,
    showFocusPresence: true,
    liveProgress: true,
  },
  island: {
    minSide: 7,
    /** Height of one terrain level (levels run 1..3), in blocks. */
    levelHeight: 0.5,
    /** Grass tiles requested per animal (includes free space). */
    tilesPerAnimal: 3,
    /** Depth of the inverted pyramid: the center column is about `coneSlope × half-width` layers deep. */
    coneSlope: 1.6,
    /** Chance that a column with 3+ layers ends one layer early (natural gaps). */
    columnShortenChance: 0.25,
    terrain: {
      /** Height units per tile that raise the back (-x, -z) and lower the front; a tendency, not a rule. */
      tilt: 0.1,
      /** Strength of the noise relative to the tilt. */
      noise: 0.9,
      /** Heights above `hill` become level 3, below `lowland` level 1; the band between is plains (level 2). */
      hill: 0.45,
      lowland: -0.5,
      /** Ground is fully flat within `flatRadius` tiles of the camp and blends back to natural by `blendRadius`. */
      flatRadius: 2.5,
      blendRadius: 4.5,
    },
    /** Max random inset of the rounded-square outline, in tiles. */
    outlineJitter: 0.45,
  },
  stream: {
    /** Lateral offsets (tiles from the center) of the candidate chords the stream is picked from. */
    offsets: [-1.75, -1.25, -0.75, 0, 0.75, 1.25, 1.75],
    /** Meander phases tried per chord. */
    variants: 8,
    /** Path length in blocks and sideways meander amplitude in tiles. */
    length: 30,
    meander: 0.8,
    /** Bed depth below the bank surface and water thickness above the bed, in blocks. */
    bedDepth: 0.25,
    waterDepth: 0.12,
    /** Stream width in blocks (the rest of each tile is bank at the surrounding height), and the drop where the stream leaves the rim. */
    width: 0.7,
    edgeDrop: 2.5,
    /** Flow streak speed (blocks/s), splash particles per fall and their life (s). */
    flowSpeed: 0.6,
    splashCount: 12,
    splashLifeS: 0.8,
    /** The spring where the stream starts: particles per burst cycle and their life (s). */
    springCount: 22,
    springLifeS: 1.1,
  },
  ui: {
    holdToAbandonMs: 1500,
    controlsVisibleMs: 3000,
    /** Reveal length before the new animal joins the island. */
    revealMs: 3500,
    /** Display tick; never the source of truth for time. */
    tickMs: 250,
    /** A chime is only played if the threshold was crossed this recently. */
    chimeFreshMs: 3000,
    /** Month calendar heatmap: a day reaches level i+1 at `heatMinutes[i]` focus minutes (levels 1–4). */
    heatMinutes: [1, 30, 60, 120],
    /** How often expired animals are checked for while not focusing (Step 2.2). */
    expiryCheckMs: 60_000,
    /** HUD gold count-up (DESIGN.md 6.8): starts once the first coins have landed. */
    goldCountDelayMs: 600,
    goldCountMs: 1000,
  },
  render: {
    /** Frame rate cap on the Focus screen. */
    focusFps: 24,
    /** Animal idle animation speed on the Focus screen. */
    focusAnimalTimeScale: 0.25,
    /** Island growth animation length. */
    growthMs: 700,
    /** Camera transition between screens (matches --motion-scene). */
    sceneMs: 1000,
    /** Island bobbing. */
    bobPeriodS: 5,
    bobAmplitude: 0.12,
    /** Fit margin around the island. */
    fitMargin: 0.05,
    /** Share of the island underside included when fitting the camera. */
    undersideFit: 0.35,
    /** World scale of animals relative to their 1/6-block voxel models. */
    animalScale: 0.25,
    /** Home camera limits. */
    azimuthLimitDeg: 135,
    zoomMin: 0.8,
    zoomMax: 2.1,
    /** Focus camera pull-back factor (zoom multiplier). */
    focusZoomFactor: 0.88,
    maxPixelRatio: 2,
    /** Departures (DESIGN.md 18): at most this many animate; the rest vanish with one pile burst. */
    maxAnimatedDepartures: 10,
  },
} as const;
