/**
 * Every gameplay tunable shared by client and server (guidance_v2 §2.6, §8). The server stores
 * `BALANCE_VERSION` with every settlement so old results stay reproducible: bump it whenever a
 * value changes. Later phases add their sections here.
 */
export const BALANCE_VERSION = '2026-10-07.1';

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
  },
} as const);

export type Balance = typeof balance;
