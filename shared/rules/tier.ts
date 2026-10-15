/** 0 Common, 1 Mythic, 2 Epic, 3 Legendary. Rules key off the rank, never the name (guidance_v2 §2.8). */
export type TierRank = 0 | 1 | 2 | 3;
export const TIER_RANKS: readonly TierRank[] = [0, 1, 2, 3];
