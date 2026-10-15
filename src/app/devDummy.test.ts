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

  it('holds 140 gold from past credits', () => {
    const { ledger } = createDummyData(now);
    expect(ledger.reduce((sum, e) => sum + e.amount, 0)).toBe(140);
    expect(ledger.every((e) => e.at < now)).toBe(true);
  });
});
