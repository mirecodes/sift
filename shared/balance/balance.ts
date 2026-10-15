/**
 * Every gameplay tunable shared by client and server (guidance_v2 §2.6, §8). The server stores
 * `BALANCE_VERSION` with every settlement so old results stay reproducible: bump it whenever a
 * value changes. Later phases add their sections here.
 */
export const BALANCE_VERSION = '2026-10-08.3';

const MINUTE = 60_000;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

export const balance = deepFreeze({
  reward: {
    /** Minimum effective focus time that earns a reward. */
    minFocusMs: 25 * MINUTE,
    /** Effective focus time is capped here. */
    maxFocusMs: 60 * MINUTE,
    /** Tier probabilities by rank (Common, Mythic, Epic, Legendary) at the minimum and at the cap; linearly interpolated between. */
    tierAtMin: [0.6, 0.28, 0.1, 0.02],
    tierAtMax: [0.5, 0.32, 0.14, 0.04],
  },
  timer: {
    focusMinutes: { default: 25, min: 5, max: 60, step: 5 },
    breakMinutes: { default: 5, min: 1, max: 30, step: 1 },
  },
  placement: {
    /** Weight of a free tile is 1 / (1 + centerBias × distance²): new animals prefer the center. */
    centerBias: 0.35,
    /** With no free tile left, animals share a tile, at most this many on one (Step 3.13). */
    maxPerTile: 4,
  },
  stats: {
    /** Abandoned (stopped) sessions count toward focus time. */
    includeAbandoned: false,
  },
  economy: {
    /** Gold granted once per save when the economy starts (§9 Q12). */
    starterGold: 30,
    /** An active animal departs this long after it was earned and leaves gold. */
    animalLifetimeDays: 7,
    /** Never expire: the Unicorn is the island-move currency (F5). */
    expiryExemptSpecies: ['unicorn'],
    /** Gold left by a departing animal, by tier rank (Common, Mythic, Epic, Legendary). */
    goldByTierRank: [1, 3, 8, 25],
    /** Coin pile visual levels 1..6 start at these balances (the pile shows a bucket, not exact gold). */
    pileThresholds: [1, 10, 30, 100, 300, 1000],
  },
  build: {
    /** Tiles that must stay free for animals after placing a building (Step 3.11). */
    minFreeTiles: 6,
  },
  shop: {
    /** Items show a New badge this long after their release date (Step 3.9). */
    newBadgeDays: 14,
  },
  /** Allowed shop price ranges [min, max] in gold (§8); `content:validate` enforces them. */
  prices: {
    /** Skins generated from a family, by family and tier. */
    familySkin: [25, 60],
    /** Handcrafted skins (e.g. White Tiger). */
    handcraftedSkin: [60, 80],
    blockTheme: [120, 200],
    /** Fence 10 … windmill 80. */
    building: [10, 80],
  },
} as const);

export type Balance = typeof balance;
