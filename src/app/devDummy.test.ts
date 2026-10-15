import { describe, expect, it } from 'vitest';
import { createDummyData } from './devDummy';

describe('createDummyData', () => {
  const now = Date.parse('2026-10-07T15:00:00Z');

  it('is deterministic for the same moment', () => {
    expect(createDummyData(now)).toEqual(createDummyData(now));
  });

  it('gives weeks of finished sessions, none in the future, some stopped', () => {
    const { sessions } = createDummyData(now);
    expect(sessions.length).toBeGreaterThan(40);
    expect(sessions.every((s) => s.endedAt !== undefined && s.endedAt <= now)).toBe(true);
    expect(sessions.some((s) => s.status === 'abandoned')).toBe(true);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(sessions.length);
  });

  it('queues notices for the Inbox', () => {
    expect(createDummyData(now).inbox.length).toBeGreaterThan(0);
  });

  it('has animals of every age: expired, about to expire, with time left, and a Unicorn', () => {
    const { animals } = createDummyData(now);
    const ages = animals.map((a) => (now - a.acquiredAt) / 86_400_000);
    expect(animals.every((a) => a.species)).toBe(true);
    expect(ages.filter((d) => d >= 7).length).toBeGreaterThan(1);
    expect(ages.filter((d) => d < 7 && d > 6.99)).toHaveLength(2);
    expect(animals.some((a) => a.species.id === 'unicorn')).toBe(true);
  });

  it('holds 140 gold from past credits', () => {
    const { ledger } = createDummyData(now);
    expect(ledger.reduce((sum, e) => sum + e.amount, 0)).toBe(140);
    expect(ledger.every((e) => e.at < now)).toBe(true);
  });
});
