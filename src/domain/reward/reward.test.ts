import { describe, expect, it } from 'vitest';
import { TIER_RANKS } from '../config';
import { getSpecies } from '../animals/catalog';
import { isEligible, pickSpecies, rollReward, rollTier, tierProbabilities } from './reward';

const MIN = 60_000;
const sum = (o: readonly number[]) => o.reduce((a, b) => a + b, 0);
const [COMMON, MYTHIC, EPIC, LEGENDARY] = [0, 1, 2, 3] as const;

describe('eligibility', () => {
  it('needs at least 25 minutes', () => {
    expect(isEligible(25 * MIN - 1)).toBe(false);
    expect(isEligible(25 * MIN)).toBe(true);
    expect(rollReward(24 * MIN, () => 0)).toBeUndefined();
  });
});

describe('tierProbabilities', () => {
  it('matches the anchors', () => {
    expect(tierProbabilities(25 * MIN)).toEqual([0.6, 0.28, 0.1, 0.02]);
    const max = tierProbabilities(60 * MIN);
    expect(max[COMMON]).toBeCloseTo(0.5);
    expect(max[LEGENDARY]).toBeCloseTo(0.04);
  });

  it('interpolates linearly and always sums to 1', () => {
    for (let m = 0; m <= 90; m += 0.5) expect(sum(tierProbabilities(m * MIN))).toBeCloseTo(1, 10);
    const mid = tierProbabilities(42.5 * MIN);
    expect(mid[COMMON]).toBeCloseTo(0.55);
    expect(mid[EPIC]).toBeCloseTo(0.12);
  });

  it('clamps beyond the cap', () => {
    expect(tierProbabilities(600 * MIN)).toEqual(tierProbabilities(60 * MIN));
  });
});

describe('rollTier', () => {
  it('walks the cumulative distribution', () => {
    const at25 = 25 * MIN;
    expect(rollTier(at25, () => 0)).toBe(COMMON);
    expect(rollTier(at25, () => 0.59)).toBe(COMMON);
    expect(rollTier(at25, () => 0.61)).toBe(MYTHIC);
    expect(rollTier(at25, () => 0.89)).toBe(EPIC);
    expect(rollTier(at25, () => 0.99)).toBe(LEGENDARY);
    expect(rollTier(at25, () => 0.999999)).toBe(LEGENDARY);
  });

  it('is statistically close to the distribution', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const counts = [0, 0, 0, 0];
    const n = 50_000;
    for (let i = 0; i < n; i++) counts[rollTier(60 * MIN, rng)]! += 1;
    const p = tierProbabilities(60 * MIN);
    for (const r of TIER_RANKS) expect(counts[r]! / n).toBeCloseTo(p[r]!, 1);
  });
});

describe('pickSpecies', () => {
  it('always returns a species of the requested tier', () => {
    for (const rank of TIER_RANKS) {
      for (const r of [0, 0.3, 0.999999]) expect(pickSpecies(rank, () => r).tierRank).toBe(rank);
    }
  });

  it('legendary (the top tier) is the unicorn or the tiger', () => {
    // Catalog order inside a tier is by id (one folder per animal).
    expect(pickSpecies(LEGENDARY, () => 0).id).toBe('tiger');
    expect(pickSpecies(LEGENDARY, () => 0.99).id).toBe('unicorn');
    expect(getSpecies('fish').tierRank).toBe(COMMON);
  });
});
