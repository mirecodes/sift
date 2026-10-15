import { describe, expect, it } from 'vitest';
import { TIER_RANKS, TIERS, tierName, tierRank } from '../config';
import { CATALOG, getSpecies, speciesByRank } from './catalog';

describe('catalog', () => {
  it('has 50 unique species split 25 / 14 / 9 / 2', () => {
    expect(CATALOG).toHaveLength(50);
    expect(new Set(CATALOG.map((a) => a.id)).size).toBe(50);
    expect(TIER_RANKS.map((r) => speciesByRank(r).length)).toEqual([25, 14, 9, 2]);
  });

  it('marks the special idle animations', () => {
    expect(getSpecies('fish').idleAnimation).toBe('flop');
    expect(getSpecies('unicorn').idleAnimation).toBe('rainbow');
    expect(getSpecies('tiger').idleAnimation).toBe('sparkle');
  });

  it('throws on unknown ids', () => {
    expect(() => getSpecies('dragon')).toThrow();
  });
});

describe('tier rank (guidance_v2 §2.8)', () => {
  it('maps Common 0, Mythic 1, Epic 2, Legendary 3 both ways', () => {
    expect(TIERS.map(tierRank)).toEqual([0, 1, 2, 3]);
    expect(['common', 'mythic', 'epic', 'legendary'].map((t) => tierRank(t as never))).toEqual([0, 1, 2, 3]);
    expect(TIER_RANKS.map(tierName)).toEqual(['common', 'mythic', 'epic', 'legendary']);
  });

  it('every species label matches its rank', () => {
    for (const s of CATALOG) expect(tierName(s.tierRank)).toBe(s.tier);
    expect(getSpecies('unicorn').tierRank).toBe(3);
    expect(getSpecies('fox').tierRank).toBe(2);
    expect(getSpecies('cat').tierRank).toBe(1);
  });
});
