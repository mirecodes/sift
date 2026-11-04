import { describe, expect, it } from 'vitest';
import { simulateBattle, type Fighter } from '../../../shared/rules/war';
import { BATTLE_MAX_S, LAND_S, planWar, poseAt, shipAt, VOYAGE_S } from './warTimeline';

const fighter = (id: string, rank: number, x: number, z: number): Fighter => ({ id, speciesId: 'fox', tierRank: rank, x, z });

function war(attackers: Fighter[], defenders: Fighter[], seed = 3) {
  const b = simulateBattle(attackers, defenders, seed);
  return { attackers, defenders, rounds: b.rounds, vanished: b.vanished, fallen: b.fallen };
}

describe('war replay timeline (Step 9.6)', () => {
  it('lasts at most ~30 s even for 100 against 100', () => {
    const w = war(
      Array.from({ length: 100 }, (_, i) => fighter(`a${i}`, i % 4, (i % 10) - 5, 6 + Math.floor(i / 10))),
      Array.from({ length: 100 }, (_, i) => fighter(`d${i}`, i % 4, (i % 10) - 5, -Math.floor(i / 10))),
    );
    const plan = planWar(w);
    expect(plan.battleEnd - plan.battleStart).toBeLessThanOrEqual(BATTLE_MAX_S + 1e-9);
    expect(plan.total).toBeLessThanOrEqual(32);
  });

  it('keeps attackers aboard during the voyage, then lands them in formation', () => {
    const w = war([fighter('a', 3, 0, 5)], [fighter('d', 0, 0, 0)]);
    const plan = planWar(w);
    const a = plan.fighters.find((f) => f.id === 'a')!;
    expect(poseAt(plan, a, 1).opacity).toBe(0);
    expect(poseAt(plan, a, VOYAGE_S + LAND_S).opacity).toBe(1);
    expect(poseAt(plan, a, VOYAGE_S + LAND_S)).toMatchObject({ x: 0, z: 5 });
  });

  it('moves duelists to the meeting point; the loser fades out and stays gone', () => {
    const w = war([fighter('a', 3, 0, 4)], [fighter('d', 0, 0, 0)]);
    const plan = planWar(w);
    const loser = plan.fighters.find((f) => f.fellIn !== null)!;
    const winner = plan.fighters.find((f) => f.fellIn === null)!;
    const end = plan.battleEnd + 0.5;
    expect(poseAt(plan, loser, end).opacity).toBe(0);
    expect(poseAt(plan, winner, end)).toMatchObject({ x: 0, z: 2, opacity: 1 });
    // Mid-approach they are between start and meeting point.
    const mid = poseAt(plan, winner, plan.battleStart + plan.roundS * 0.25);
    expect(Math.abs(mid.z - 2)).toBeLessThan(2);
  });

  it('flies the ship in, keeps it docked, and flies it away', () => {
    const plan = planWar(war([fighter('a', 3, 0, 4)], [fighter('d', 0, 0, 0)]));
    const dock: [number, number, number] = [0, 2, 6];
    expect(shipAt(plan, 0, dock).position[0]).toBeLessThan(-10);
    expect(shipAt(plan, plan.battleStart + 0.1, dock).position).toEqual(dock);
    expect(shipAt(plan, plan.total + 1, dock).visible).toBe(false);
  });
});
