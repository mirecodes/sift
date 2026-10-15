/**
 * Every tunable number in the app. `domain/` imports nothing outside itself,
 * so this file is plain data. Change values here only.
 */

export type Tier = 'common' | 'mythic' | 'epic' | 'legendary';

/** Lowest to highest rank: Common, Mythic, Epic, Legendary (ADR-027). */
export const TIERS: readonly Tier[] = ['common', 'mythic', 'epic', 'legendary'];

/** Position in `TIERS`. Logic keys off the rank, never the name (guidance_v2 §2.8). */
export type TierRank = 0 | 1 | 2 | 3;
export const tierRank = (tier: Tier): TierRank => TIERS.indexOf(tier) as TierRank;

export const DEFAULT_BLOCK_THEME = 'default';

const MINUTE = 60_000;

export const config = {
  reward: {
    /** Minimum effective focus time that earns a reward. */
    minFocusMs: 25 * MINUTE,
    /** Effective focus time is capped here. */
    maxFocusMs: 60 * MINUTE,
    /** Tier probabilities at the minimum and at the cap; linearly interpolated between. */
    tierAtMin: { common: 0.6, mythic: 0.28, epic: 0.1, legendary: 0.02 } as Record<Tier, number>,
    tierAtMax: { common: 0.5, mythic: 0.32, epic: 0.14, legendary: 0.04 } as Record<Tier, number>,
  },
  settings: {
    focusMinutes: { default: 25, min: 5, max: 60, step: 5 },
    breakMinutes: { default: 5, min: 1, max: 30, step: 1 },
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
    /** Every tile within this many tiles of the center is preferred for placement. */
    placementCenterBias: 0.35,
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
    azimuthLimitDeg: 30,
    zoomMin: 0.8,
    zoomMax: 2.1,
    /** Focus camera pull-back factor (zoom multiplier). */
    focusZoomFactor: 0.88,
    maxPixelRatio: 2,
  },
} as const;
