import { describe, expect, it } from 'vitest';
import { content } from '../domain/content';
import { sanitizeEquipped, unplacedBuildings } from '../domain/cosmetics/inventory';
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

  it('owns real items, equips only owned ones on species it has, and places owned buildings', () => {
    const { cosmetics, equipped, buildings, animals } = createDummyData(now);
    for (const c of cosmetics) expect(content.get(c.defId)?.kind, c.defId).toBe(c.kind);
    expect(sanitizeEquipped(equipped, cosmetics)).toEqual(equipped);
    const species = new Set(animals.map((a) => a.species.id));
    for (const s of Object.keys(equipped.skinBySpecies)) expect(species.has(s)).toBe(true);
    for (const b of buildings) expect(cosmetics.some((c) => c.defId === b)).toBe(true);
    expect(unplacedBuildings(cosmetics, buildings.map((defId) => ({ defId }))).size).toBeGreaterThan(0);
  });

  it('holds 140 gold from past credits', () => {
    const { ledger } = createDummyData(now);
    expect(ledger.reduce((sum, e) => sum + e.amount, 0)).toBe(140);
    expect(ledger.every((e) => e.at < now)).toBe(true);
  });
});
