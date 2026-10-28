import { describe, expect, it } from 'vitest';
import { balance } from '../balance/balance';
import type { PlacedAnimal } from '../types/rows';
import { attackArmy, defenseArmy, higherFallChance, landingFormation, lootFor, simulateBattle, type Fighter } from './war';

const f = (id: string, tierRank: number, x: number, z: number, speciesId = 'fox'): Fighter => ({ id, speciesId, tierRank, x, z });
const army = (prefix: string, n: number, rank = 0, z = 0): Fighter[] => Array.from({ length: n }, (_, i) => f(`${prefix}${i}`, rank, i - n / 2, z));

describe('armies and formation (Steps 9.1, 9.2)', () => {
  const animal = (id: string, speciesId: string, over: Partial<PlacedAnimal> = {}): PlacedAnimal => ({
    id, speciesId, tier: 'common', tierRank: 0, tileX: 0, tileZ: 0, acquiredAt: 0, sessionId: 's', status: 'active', endedAt: null, endReason: null, verified: true, pinned: false, ...over,
  });

  it('keeps Unicorns home when attacking and lets them defend; unverified and departed never fight', () => {
    const all = [animal('u', 'unicorn'), animal('f', 'fox'), animal('x', 'fox', { verified: false }), animal('d', 'fox', { status: 'departed' })];
    expect(attackArmy(all).map((a) => a.id)).toEqual(['f']);
    expect(defenseArmy(all).map((a) => a.id)).toEqual(['u', 'f']);
  });

  it('lines up highest ranks in front, Tigers leading, centered on the strip', () => {
    const out = landingFormation([f('c', 0, 0, 0), f('t', 3, 0, 0, 'tiger'), f('l', 3, 0, 0, 'peacock'), f('e', 2, 0, 0)], 3);
    expect(out.map((x) => x.id)).toEqual(['t', 'l', 'e', 'c']);
    expect(out.map((x) => x.x)).toEqual([0, 1, -1, 2]);
    expect(out.every((x) => x.z === 4.5)).toBe(true);
  });
});

describe('battle (Step 9.3)', () => {
  it('is deterministic for a seed', () => {
    const a = army('a', 8, 1, 5);
    const d = army('d', 10, 0, 0);
    expect(simulateBattle(a, d, 42)).toEqual(simulateBattle(a, d, 42));
    expect(simulateBattle(a, d, 43)).not.toEqual(simulateBattle(a, d, 42));
  });

  it('keeps its invariants over many seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const a = army('a', 1 + (seed % 9), seed % 4, 5);
      const d = [...army('d', 1 + (seed % 7), (seed + 1) % 4, 0), f('uni', 3, 0, 0, 'unicorn')];
      const r = simulateBattle(a, d, seed);
      for (const round of r.rounds) for (const duel of round.duels) expect([duel.a, duel.d]).toContain(duel.loser);
      const falls = r.rounds.flatMap((x) => x.duels).length;
      expect(r.fallen.length).toBe(falls);
      const aLeft = a.filter((x) => !r.fallen.includes(x.id)).length;
      const dLeft = d.filter((x) => !r.fallen.includes(x.id)).length;
      expect(aLeft === 0 || dLeft === 0).toBe(true);
      expect(aLeft === 0 && dLeft === 0).toBe(false);
      expect(r.winner).toBe(dLeft === 0 ? 'attacker' : 'defender');
      expect(r.vanished.every((id) => r.fallen.includes(id))).toBe(true);
      expect(r.protected.every((id) => d.some((x) => x.id === id))).toBe(true);
    }
  });

  it('decides duels with the configured odds (10,000 runs)', () => {
    let higherFell = 0;
    let evenA = 0;
    const N = 10_000;
    for (let seed = 0; seed < N; seed++) {
      const r = simulateBattle([f('a', 2, 0, 1)], [f('d', 1, 0, 0)], seed);
      if (r.fallen[0] === 'a') higherFell++;
      if (simulateBattle([f('a', 1, 0, 1)], [f('d', 1, 0, 0)], seed + N).fallen[0] === 'a') evenA++;
    }
    expect(higherFallChance(1)).toBeCloseTo(1 / 11);
    expect(higherFell / N).toBeGreaterThan(1 / 11 - 0.012);
    expect(higherFell / N).toBeLessThan(1 / 11 + 0.012);
    expect(evenA / N).toBeGreaterThan(0.48);
    expect(evenA / N).toBeLessThan(0.52);
    expect(higherFallChance(3)).toBeCloseTo(1 / 1001);
    expect(higherFallChance(4, { ...balance.war, lossOdds: { base: 10, byGap: [1, 10] } })).toBeCloseTo(1 / 10_001);
  });

  it('vanishes 25 % of the fallen, 5 % inside a Unicorn aura (10,000 runs)', () => {
    let open = 0;
    let shielded = 0;
    const N = 10_000;
    for (let seed = 0; seed < N; seed++) {
      // A Legendary attacker beats the Common defender almost always; the defender's fate is what we count.
      const far = simulateBattle([f('a', 3, 9, 9)], [f('d', 0, 9, 8), f('uni', 3, 0, 0, 'unicorn')], seed);
      if (far.fallen.includes('d')) open += far.vanished.includes('d') ? 1 : 0;
      const near = simulateBattle([f('a', 3, 2, 3)], [f('d', 0, 2, 2), f('uni', 3, 0, 0, 'unicorn')], seed);
      if (near.fallen.includes('d')) shielded += near.vanished.includes('d') ? 1 : 0;
    }
    expect(open / N).toBeGreaterThan(0.23);
    expect(open / N).toBeLessThan(0.27);
    expect(shielded / N).toBeGreaterThan(0.035);
    expect(shielded / N).toBeLessThan(0.065);
  });

  it('draws the aura as a 5×5 square around each defending Unicorn', () => {
    const d = [f('uni', 3, 0, 0, 'unicorn'), f('two', 0, 2, 0), f('diag', 0, 2, 2), f('three', 0, 3, 0), f('far', 0, -3, 1)];
    expect(simulateBattle([f('a', 0, 9, 9)], d, 1).protected).toEqual(['diag', 'two', 'uni']);
  });
});

describe('loot (Step 9.4)', () => {
  it('takes the bracket of the defender’s balance', () => {
    const cases: [number, number][] = [[0, 0], [19, 0], [20, 5], [49, 5], [50, 10], [99, 10], [100, 20], [199, 20], [200, 35], [499, 35], [500, 60], [999, 60], [1000, 100], [50_000, 100]];
    for (const [gold, loot] of cases) expect(lootFor(gold), `${gold}`).toBe(loot);
  });

  it('never takes more than there is, and respects a weekly cap', () => {
    const cfg = { ...balance.war, lootBrackets: [{ minGold: 0, loot: 30 }] };
    expect(lootFor(12, 0, cfg)).toBe(12);
    const capped = { ...balance.war, lootLostCapPerWeek: 25 };
    expect(lootFor(300, 0, capped)).toBe(25);
    expect(lootFor(300, 20, capped)).toBe(5);
    expect(lootFor(300, 30, capped)).toBe(0);
  });
});
