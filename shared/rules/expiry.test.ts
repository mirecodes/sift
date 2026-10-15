import { describe, expect, it } from 'vitest';
import { balance } from '../balance/balance';
import { computeExpirations, expiresAt, type ExpiryAnimal } from './expiry';

const DAY = 24 * 60 * 60 * 1000;
const cfg = balance.economy;
const animal = (id: string, acquiredAt: number, tierRank: 0 | 1 | 2 | 3 = 0, speciesId = 'fox'): ExpiryAnimal => ({ id, speciesId, tierRank, acquiredAt, status: 'active' });

describe('computeExpirations (Step 2.2)', () => {
  it('expires exactly at 7 days, not a millisecond before', () => {
    const a = animal('a', 1000);
    expect(computeExpirations([a], 1000 + 7 * DAY - 1, cfg)).toEqual([]);
    expect(computeExpirations([a], 1000 + 7 * DAY, cfg)).toEqual([{ animalId: 'a', expiredAt: 1000 + 7 * DAY, gold: 1 }]);
  });

  it('gold follows the tier rank: 1, 3, 8, 25', () => {
    const list = [animal('c', 0, 0), animal('m', 0, 1), animal('e', 0, 2), animal('l', 0, 3, 'tiger')];
    expect(computeExpirations(list, 8 * DAY, cfg).map((x) => x.gold)).toEqual([1, 3, 8, 25]);
  });

  it('never expires an exempt species (Unicorn)', () => {
    const u = animal('u', 0, 3, 'unicorn');
    expect(computeExpirations([u], 100 * DAY, cfg)).toEqual([]);
    expect(expiresAt(u, cfg)).toBeNull();
    expect(expiresAt(animal('f', 5), cfg)).toBe(5 + 7 * DAY);
  });

  it('a long absence expires many at once, each at its own real moment', () => {
    const list = Array.from({ length: 40 }, (_, i) => animal(`a${i}`, i * DAY));
    const out = computeExpirations(list, 60 * DAY, cfg);
    expect(out).toHaveLength(40);
    expect(out[3]?.expiredAt).toBe(10 * DAY);
    expect(out[39]?.expiredAt).toBe(46 * DAY);
  });

  it('ignores animals that are no longer active, so applying the result is idempotent', () => {
    const list = [animal('a', 0), { ...animal('b', 0), status: 'departed' }, { ...animal('c', 0), status: 'vanished' }];
    const first = computeExpirations(list, 8 * DAY, cfg);
    expect(first.map((x) => x.animalId)).toEqual(['a']);
    const applied = list.map((a) => (first.some((x) => x.animalId === a.id) ? { ...a, status: 'departed' } : a));
    expect(computeExpirations(applied, 8 * DAY, cfg)).toEqual([]);
  });
});
