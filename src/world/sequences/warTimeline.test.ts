import { describe, expect, it } from 'vitest';
import { landOnIsland, simulateBattle, type Fighter } from '../../../shared/rules/war';
import { BATTLE_MAX_S, DECK_Y, planWar, poseAt, shipAt, VOYAGE_S } from './warTimeline';

const fighter = (id: string, rank: number, x: number, z: number): Fighter => ({ id, speciesId: 'fox', tierRank: rank, x, z });
const tiles = Array.from({ length: 81 }, (_, i) => ({ x: (i % 9) - 4, z: Math.floor(i / 9) - 4 }));

function war(attackers: Fighter[], defenders: Fighter[], seed = 3) {
  const landed = landOnIsland(attackers, tiles, seed);
  const b = simulateBattle(landed, defenders, seed);
  return { attackers: landed, defenders, rounds: b.rounds, vanished: b.vanished, fallen: b.fallen, protected: b.protected };
}
const dock: [number, number, number] = [0, 1, 6];

describe('war replay timeline (Step 9.6, owner rework 2026-11-04)', () => {
  it('squeezes 100 against 100 into ~26 s of battle', () => {
    const w = war(
      Array.from({ length: 100 }, (_, i) => fighter(`a${i}`, i % 4, 0, 0)),
      Array.from({ length: 100 }, (_, i) => fighter(`d${i}`, i % 4, (i % 9) - 4, Math.floor(i / 12) - 4)),
    );
    const plan = planWar(w, { dock });
    expect(plan.battleEnd - plan.battleStart).toBeLessThanOrEqual(BATTLE_MAX_S + 1e-9);
    expect(plan.total).toBeLessThanOrEqual(VOYAGE_S + BATTLE_MAX_S + 1.5);
  });

  it('rides on deck during the voyage, then hops onto its own tile one after another', () => {
    const w = war(Array.from({ length: 6 }, (_, i) => fighter(`a${i}`, 3 - (i % 4), 0, 0)), [fighter('d', 0, 0, 0)]);
    const plan = planWar(w, { dock });
    const attackers = plan.fighters.filter((f) => f.side === 'attacker');
    const a = attackers[0]!;
    const onDeck = poseAt(plan, a, 1);
    expect(onDeck.y).toBeCloseTo(shipAt(plan, 1).position[1] + DECK_Y, 1);
    expect(onDeck.scale).toBe(1);
    const landed = poseAt(plan, a, a.hop!.end + 0.01);
    expect([landed.x, landed.z]).toEqual(a.start);
    // "Pop, pop, pop": every hop starts later than the one before.
    const starts = attackers.map((f) => f.hop!.start);
    expect([...starts].sort((x, y) => x - y)).toEqual(starts);
    expect(new Set(starts).size).toBe(starts.length);
    expect(plan.effects.filter((e) => e.kind === 'land')).toHaveLength(6);
  });

  it('spreads the duels of a step over time instead of starting them together', () => {
    const w = war(
      Array.from({ length: 12 }, (_, i) => ({ ...fighter(`a${i}`, 1, (i % 4) - 2, 3), landAt: 0 })),
      Array.from({ length: 12 }, (_, i) => fighter(`d${i}`, 1, (i % 4) - 2, -3 + Math.floor(i / 4))),
    );
    const plan = planWar(w, { dock });
    const firstStep = new Set(w.rounds[0]!.duels.map((d) => d.a));
    const starts = plan.fighters.filter((f) => firstStep.has(f.id)).map((f) => f.duels[0]!.start);
    expect(new Set(starts.map((s) => s.toFixed(3))).size).toBeGreaterThan(starts.length / 2);
    // Nobody fights two duels at once.
    for (const f of plan.fighters) for (let i = 1; i < f.duels.length; i++) expect(f.duels[i]!.start).toBeGreaterThanOrEqual(f.duels[i - 1]!.end - 1e-9);
  });

  it('ends with losers gone and winners standing; hits flash; poofs only for animals that left for good', () => {
    const w = war([{ ...fighter('a', 3, 0, 2), landAt: 0 }], [fighter('d', 0, 0, -2)], 1);
    const plan = planWar(w, { dock });
    const loser = plan.fighters.find((f) => f.id === w.fallen[0])!;
    const winner = plan.fighters.find((f) => f.id !== loser.id)!;
    expect(poseAt(plan, loser, plan.battleEnd + 0.5).scale).toBe(0);
    const end = poseAt(plan, winner, plan.battleEnd + 0.5);
    expect(end.scale).toBe(1);
    expect([end.x, end.z]).toEqual(winner.duels.at(-1)!.at);
    const hit = loser.duels[0]!.hit2;
    expect(poseAt(plan, loser, hit).flash).toBeGreaterThan(0.9);
    expect(plan.effects.filter((e) => e.kind === 'hit')).toHaveLength(2);
    expect(plan.effects.some((e) => e.kind === 'poof')).toBe(w.vanished.length > 0);
  });

  it('replays older wars (attackers stored off the island, no landing waves)', () => {
    const old = { attackers: [fighter('a', 2, 0, 5)], defenders: [fighter('d', 0, 0, 0)], rounds: [{ duels: [{ a: 'a', d: 'd', meet: [0, 2.5] as [number, number], loser: 'd' }] }], vanished: [], protected: [] };
    const plan = planWar(old, { dock, land: () => [0, 3] });
    expect(plan.fighters.find((f) => f.id === 'a')!.start).toEqual([0, 3]);
    expect(plan.total).toBeGreaterThan(VOYAGE_S);
  });

  it('sails in from the side, rides at the dock, and leaves after the result', () => {
    const plan = planWar(war([fighter('a', 3, 0, 0)], [fighter('d', 0, 0, 0)]), { dock });
    expect(shipAt(plan, 0).position[0]).toBeLessThan(-10);
    expect(shipAt(plan, VOYAGE_S + 0.5).position[0]).toBe(0);
    expect(Math.abs(shipAt(plan, VOYAGE_S + 0.5).position[1] - dock[1])).toBeLessThan(0.1);
    expect(shipAt(plan, plan.total + 1).visible).toBe(false);
  });
});
