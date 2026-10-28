/**
 * Every gameplay tunable shared by client and server (guidance_v2 §2.6, §8). The server stores
 * `BALANCE_VERSION` with every settlement so old results stay reproducible: bump it whenever a
 * value changes. Later phases add their sections here.
 */
export const BALANCE_VERSION = '2026-10-27.3';

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
  islandMove: {
    /** Unicorns spent per island move (F5). */
    cost: 1,
    /** New-island previews offered before confirming (Step 4.1). */
    freePreviews: 3,
  },
  identity: {
    /** A chosen name can change once per this many days (the first choice is free). */
    nameChangeCooldownDays: 30,
  },
  social: {
    maxFriends: 100,
    /** Visit rows are kept this long (Step 7.5). */
    visitRetentionDays: 30,
    /** A visited island's snapshot is reused this long (Step 7.4). */
    snapshotCacheMs: 60_000,
    /** Friends' "Focusing now" is refreshed this often while visible (presence is polled, ADR-047). */
    presencePollMs: 30_000,
    /** Members per group, owner included (Step 8.1). */
    maxGroupSize: 10,
    /** After leaving a group, joining any group waits this long (anti-farming). */
    groupRejoinCooldownHours: 24,
    /** A weekly winner needs at least this many members for the whole week (Step 8.6). */
    minMembersForReward: 3,
    weeklyWinnerGold: 50,
    /** Invite codes: letters and digits without look-alikes. */
    inviteCodeLength: 8,
  },
  /** Island score (Step 8.3, owner decision rev 2). */
  scoring: {
    /** Points per active verified animal, by tier rank. */
    tierPoints: [1, 3, 10, 30],
    /** Extra points for particular species (none yet). */
    speciesBonus: {} as Record<string, number>,
    /** Animals lost in war count this share... */
    vanishedWeight: 0.5,
    /** ...until the end of the ranking week they vanished in, or until they would have expired. */
    vanishedWindow: 'rankingWeek' as 'rankingWeek' | 'untilNaturalExpiry',
  },
  /** Cooperative group missions (Step 8.5). */
  missions: {
    perMemberMinutes: 300,
    /** Share of `perMemberMinutes` per member by group size (bigger groups: not everyone is active every week). */
    sizeFactor: { 2: 1.0, 3: 0.95, 4: 0.9, 5: 0.85, 6: 0.85, 7: 0.8, 8: 0.8, 9: 0.75, 10: 0.75 } as Record<number, number>,
    /** Milestones as shares of the target, and the gold each pays every contributing member. */
    milestones: [0.5, 1.0, 1.5],
    milestoneGold: [10, 30, 30],
    /** A member must have contributed this much in the week to receive milestone gold. */
    minContributionMinutes: 25,
  },
  together: {
    /** A room's lobby stays open this long; a room never started then closes. */
    lobbyMinutes: 5,
    /** After the start, a participant may still join this long, with their own remaining time. */
    lateJoinMinutes: 2,
    /** Extra reward for focusing together: none (rewards stay individual). */
    rewardBonus: 0,
    /** Weight of together sessions in group missions (Phase 8). */
    missionMultiplier: 1.0,
    /** Participants per room, host included. */
    maxParticipants: 10,
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
