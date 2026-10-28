import { describe, expect, it } from 'vitest';
import type { ErrorCode, Op, OpArgs } from '../../shared/api/types';
import { simulateBattle } from '../../shared/rules/war';
import { seededRng } from '../../shared/rng';
import type { PlacedAnimal } from '../../shared/types/rows';
import { getSpecies } from '../../src/domain/animals/catalog';
import { newPlacedAnimal } from '../../src/domain/animals/placed';
import { pickNewAnimalTile } from '../../src/domain/island/level';
import type { ServerDb } from './db';
import { MIN, testServer } from './testing';

const HOUR = 60 * MIN;

/**
 * Phase 9 (war inside a group), run on every server database adapter: memory in `api.test.ts`,
 * Postgres (PGlite) in `pg.test.ts`.
 */
export function describeWar(name: string, makeDb: () => Promise<ServerDb> | ServerDb) {
  async function world() {
    const s = testServer({ db: await makeDb() });
    const fails = async <O extends Op>(userId: string, op: O, args: OpArgs<O>): Promise<ErrorCode | null> => {
      const r = await s.call(userId, op, args);
      return r.ok ? null : r.error.code;
    };
    const user = async (id: string, species: string[], gold = 0) => {
      await s.ok(id, 'set_handle', { name: `U${id}` });
      const rng = seededRng(id.length + 11);
      const animals: PlacedAnimal[] = [];
      species.forEach((sp, i) => {
        const tile = pickNewAnimalTile(9, animals, rng);
        if (tile) animals.push(newPlacedAnimal(`${id}-a${i}`, getSpecies(sp), tile, s.clock.t - HOUR, `${id}-s${i}`));
      });
      await s.ok(id, 'upload_local_save', { replace: false, save: { world: { seed: 9, blockThemeId: 'default' }, animals, sessions: [], ledger: gold ? [{ id: `${id}-g`, at: s.clock.t, currency: 'gold', amount: gold, reason: 'starter', refId: null }] : [], cosmetics: [], placedBuildings: [], islandHistory: [] } });
    };
    const gold = async (id: string) => (await s.ok(id, 'export_account', {})).rows.ledger.reduce((sum, e) => sum + e.amount, 0);
    /** `a` (strong attacker) and `d` (weak defender with gold) in one group, past new-member protection. */
    const armies = async (defenderGold = 120) => {
      await user('a', ['unicorn', 'tiger', 'tiger', 'wolf', 'fox']);
      await user('d', ['chick', 'chick'], defenderGold);
      const { group } = await s.ok('a', 'group_create', { name: 'Owls', timezone: 'UTC' });
      await s.ok('d', 'group_join', { code: group.inviteCode });
      s.clock.t += 49 * HOUR;
    };
    return { ...s, fails, user, gold, armies };
  }

  describe(`war (${name})`, () => {
    it('only inside one group with war on, never yourself, never with only Unicorns', async () => {
      const s = await world();
      await s.user('a', ['unicorn']);
      await s.user('d', ['chick']);
      await s.user('x', ['fox']);
      const { group } = await s.ok('a', 'group_create', { name: 'Owls', timezone: 'UTC' });
      await s.ok('d', 'group_join', { code: group.inviteCode });
      s.clock.t += 49 * HOUR;
      expect(await s.fails('a', 'declare_war', { targetId: 'x' })).toBe('not_in_group');
      expect(await s.fails('a', 'declare_war', { targetId: 'a' })).toBe('invalid');
      expect((await s.ok('a', 'war_preview', { targetId: 'd' })).preview).toMatchObject({ unicornsHome: 1, attackers: [0, 0, 0, 0], blocked: { code: 'no_army' } });
      expect(await s.fails('a', 'declare_war', { targetId: 'd' })).toBe('no_army');
      await s.ok('a', 'group_set_war', { enabled: false });
      expect(await s.fails('a', 'declare_war', { targetId: 'd' })).toBe('war_disabled');
    });

    it('protects new members for 48 h, and freezes the hour before settlement', async () => {
      const s = await world();
      await s.user('a', ['tiger']);
      await s.user('d', ['chick']);
      const { group } = await s.ok('a', 'group_create', { name: 'Owls', timezone: 'UTC' });
      await s.ok('d', 'group_join', { code: group.inviteCode });
      expect(await s.fails('a', 'declare_war', { targetId: 'd' })).toBe('protected_new_member');
      s.clock.t = Date.UTC(2026, 10, 1, 23, 30); // 30 min before Monday 00:00 UTC
      expect((await s.ok('a', 'war_preview', { targetId: 'd' })).preview.blocked).toEqual({ code: 'settlement_freeze', until: Date.UTC(2026, 10, 2) });
    });

    it('decides the battle on the server: vanished animals, loot by bracket, notices, cooldown and shield', async () => {
      const s = await world();
      await s.armies(120);
      const preview = (await s.ok('a', 'war_preview', { targetId: 'd' })).preview;
      expect(preview).toMatchObject({ unicornsHome: 1, defenders: [2, 0, 0, 0], lootIfWin: 20, blocked: null });
      const { war } = await s.ok('a', 'declare_war', { targetId: 'd' }, { requestId: 'w1' });
      expect(war.attackers.some((f) => f.speciesId === 'unicorn')).toBe(false);
      expect(war.attackers[0]!.speciesId).toBe('tiger'); // Tigers lead
      expect(war.winner).toBe('attacker');
      expect(war.lootGold).toBe(20);
      expect([await s.gold('a'), await s.gold('d')]).toEqual([20, 100]);
      // The record is the replay: the same seed gives the same battle.
      const again = simulateBattle(war.attackers, war.defenders, war.seed);
      expect({ rounds: again.rounds, vanished: again.vanished }).toEqual({ rounds: war.rounds, vanished: war.vanished });
      // Vanished animals left for good; fallen ones went home.
      const animals = [...(await s.ok('a', 'export_account', {})).rows.animals, ...(await s.ok('d', 'export_account', {})).rows.animals];
      for (const id of war.vanished) expect(animals.find((x) => x.id === id)).toMatchObject({ status: 'vanished', endReason: 'war' });
      for (const id of war.fallen.filter((x) => !war.vanished.includes(x))) expect(animals.find((x) => x.id === id)?.status).toBe('active');
      // A retry returns the same war.
      expect((await s.ok('a', 'declare_war', { targetId: 'd' }, { requestId: 'w1' })).war.id).toBe(war.id);
      // Both get a report; the defender's says what they lost.
      const reports = (await s.ok('d', 'export_account', {})).rows.notices.filter((n) => n.notice.kind === 'war_report');
      expect(reports.map((n) => n.notice)).toMatchObject([{ role: 'defender', result: 'loss', gold: -20, opponentId: 'a' }]);
      // Cooldown for the attacker, shield for the defender.
      expect(await s.fails('a', 'declare_war', { targetId: 'd' })).toBe('cooldown_active');
      await s.user('b', ['tiger']);
      await s.ok('b', 'group_join', { code: (await s.ok('a', 'group_state', {})).group!.inviteCode });
      s.clock.t += 49 * HOUR; // b past protection; d's shield (12 h) is over too
      expect(await s.fails('b', 'declare_war', { targetId: 'd' })).toBeNull();
      expect((await s.ok('a', 'war_preview', { targetId: 'd' })).preview.blocked?.code).toBe('shield_active');
    });

    it('moves no gold when the defense holds', async () => {
      const s = await world();
      await s.user('a', ['chick']);
      await s.user('d', ['tiger', 'wolf', 'unicorn'], 300);
      const { group } = await s.ok('a', 'group_create', { name: 'Owls', timezone: 'UTC' });
      await s.ok('d', 'group_join', { code: group.inviteCode });
      s.clock.t += 49 * HOUR;
      const { war } = await s.ok('a', 'declare_war', { targetId: 'd' });
      expect(war.winner).toBe('defender');
      expect(war.lootGold).toBe(0);
      expect(await s.gold('d')).toBe(300);
    });

    it('lists the wars of the group from each side and lets members watch replays', async () => {
      const s = await world();
      await s.armies(60);
      const { war } = await s.ok('a', 'declare_war', { targetId: 'd' });
      expect((await s.ok('a', 'war_list', {})).wars).toMatchObject([{ id: war.id, role: 'attacker', won: true, gold: 10 }]);
      expect((await s.ok('d', 'war_list', {})).wars).toMatchObject([{ id: war.id, role: 'defender', won: false, gold: -10 }]);
      expect((await s.ok('d', 'get_war', { warId: war.id })).war.rounds).toEqual(war.rounds);
      await s.user('x', ['fox']);
      expect(await s.fails('x', 'get_war', { warId: war.id })).toBe('not_found');
    });
  });
}
