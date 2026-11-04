import { describe, expect, it } from 'vitest';
import type { ErrorCode, Op, OpArgs } from '../../shared/api/types';
import { getSpecies } from '../../src/domain/animals/catalog';
import { newPlacedAnimal } from '../../src/domain/animals/placed';
import { pickNewAnimalTile } from '../../src/domain/island/level';
import { seededRng } from '../../shared/rng';
import type { PlacedAnimal } from '../../shared/types/rows';
import { animalPoints } from '../../shared/rules/scoring';
import { balance } from '../../shared/balance/balance';
import { runWeeklyJob } from './api';
import type { ServerDb } from './db';
import { MIN, testServer } from './testing';

const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** testServer starts Tue 2026-10-27 10:00 UTC; with timezone UTC the week is 2026-10-26 … 2026-11-02. */
const NEXT_MONDAY = Date.UTC(2026, 10, 2);
const foxGold = balance.economy.goldByTierRank[getSpecies('fox').tierRank];
const points = (species: string) => animalPoints({ speciesId: species, tierRank: getSpecies(species).tierRank });

/**
 * Phase 8 (groups, ranking, missions, weekly settlement), run on every server database adapter:
 * memory in `api.test.ts`, Postgres (PGlite) in `pg.test.ts`.
 */
export function describeGroups(name: string, makeDb: () => Promise<ServerDb> | ServerDb) {
  async function world() {
    const s = testServer({ db: await makeDb() });
    const fails = async <O extends Op>(userId: string, op: O, args: OpArgs<O>): Promise<ErrorCode | null> => {
      const r = await s.call(userId, op, args);
      return r.ok ? null : r.error.code;
    };
    /** A named user whose island holds animals of these species (verified, uploaded at first sign-in). */
    const user = async (id: string, species: string[] = []) => {
      await s.ok(id, 'set_handle', { name: `U${id}` });
      const rng = seededRng(id.length + 3);
      const animals: PlacedAnimal[] = [];
      species.forEach((sp, i) => {
        const tile = pickNewAnimalTile(7, animals, rng);
        if (tile) animals.push(newPlacedAnimal(`${id}-a${i}`, getSpecies(sp), tile, s.clock.t - DAY, `${id}-s${i}`));
      });
      await s.ok(id, 'upload_local_save', { replace: false, save: { world: { seed: 7, blockThemeId: 'default' }, animals, sessions: [], ledger: [], cosmetics: [], placedBuildings: [], islandHistory: [] } });
    };
    const gold = async (id: string) => (await s.ok(id, 'export_account', {})).rows.ledger.reduce((sum, e) => sum + e.amount, 0);
    const state = (id: string) => s.ok(id, 'group_state', {});
    /** A group of `owner` plus `others`, joined by code. */
    const group = async (owner: string, others: string[]) => {
      const { group: g } = await s.ok(owner, 'group_create', { name: 'Morning Owls', timezone: 'UTC' });
      for (const o of others) await s.ok(o, 'group_join', { code: g.inviteCode });
      return g;
    };
    /** A completed verified focus of `minutes` real minutes. */
    const focus = async (id: string, minutes: number) => {
      const { session } = await s.ok(id, 'start_session', { plannedMs: 25 * MIN });
      s.clock.t += minutes * MIN;
      return s.ok(id, 'end_session', { sessionId: session.id, endedAt: s.clock.t, status: 'completed' });
    };
    return { ...s, fails, user, gold, state, group, focus };
  }

  describe(`groups (${name})`, () => {
    it('creates, joins by code and by invite, one group per user, size limit', async () => {
      const s = await world();
      for (const id of ['a', 'b', 'c', 'd']) await s.user(id);
      expect(await s.fails('a', 'group_create', { name: 'x', timezone: 'UTC' })).toBe('handle_invalid');
      expect(await s.fails('a', 'group_create', { name: 'Owls', timezone: 'Mars/Base' })).toBe('invalid');
      const g = await s.group('a', ['b']);
      expect(g.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
      expect(await s.fails('b', 'group_create', { name: 'Other', timezone: 'UTC' })).toBe('already_in_group');
      expect(await s.fails('c', 'group_join', { code: 'NOPE0000' })).toBe('not_found');
      // An in-app invite to a friend, accepted from the Group tab.
      await s.ok('a', 'friend_request', (await s.ok('c', 'social_state', {})).me.handle!);
      await s.ok('c', 'friend_respond', { userId: 'a', accept: true });
      await s.ok('a', 'group_invite', { userId: 'c' });
      const { invites } = await s.state('c');
      expect(invites).toMatchObject([{ groupName: 'Morning Owls', memberCount: 2 }]);
      await s.ok('c', 'group_invite_respond', { inviteId: invites[0]!.id, accept: true });
      expect((await s.state('a')).group!.members.map((m) => m.person.userId).sort()).toEqual(['a', 'b', 'c']);
      // Declined invites stay declined.
      await s.ok('a', 'friend_request', (await s.ok('d', 'social_state', {})).me.handle!);
      await s.ok('d', 'friend_respond', { userId: 'a', accept: true });
      await s.ok('a', 'group_invite', { userId: 'd' });
      await s.ok('d', 'group_invite_respond', { inviteId: (await s.state('d')).invites[0]!.id, accept: false });
      expect((await s.state('d')).invites).toEqual([]);
      // Size limit.
      for (let i = 0; i < 7; i++) {
        await s.user(`m${i}`);
        await s.ok(`m${i}`, 'group_join', { code: g.inviteCode });
      }
      await s.user('late');
      expect(await s.fails('late', 'group_join', { code: g.inviteCode })).toBe('group_full');
    });

    it('owner powers: code off/regenerate, rename, remove, transfer, war toggle, disband', async () => {
      const s = await world();
      for (const id of ['a', 'b', 'c', 'd']) await s.user(id);
      const g = await s.group('a', ['b', 'c']);
      expect(await s.fails('b', 'group_code', { action: 'disable' })).toBe('not_owner');
      await s.ok('a', 'group_code', { action: 'disable' });
      expect(await s.fails('d', 'group_join', { code: g.inviteCode })).toBe('not_found');
      const { code } = await s.ok('a', 'group_code', { action: 'regenerate' });
      expect(code).not.toBe(g.inviteCode);
      await s.ok('a', 'group_rename', { name: 'Night Owls' });
      await s.ok('a', 'group_set_war', { enabled: false });
      await s.ok('a', 'group_remove_member', { userId: 'c' });
      let view = (await s.state('a')).group!;
      expect(view).toMatchObject({ name: 'Night Owls', warEnabled: false });
      expect(view.members.map((m) => m.person.userId).sort()).toEqual(['a', 'b']);
      // The owner must transfer before leaving.
      expect(await s.fails('a', 'group_leave', {})).toBe('invalid');
      await s.ok('a', 'group_transfer', { userId: 'b' });
      view = (await s.state('b')).group!;
      expect(view.ownerId).toBe('b');
      await s.ok('a', 'group_leave', {});
      // The last member leaving disbands it.
      await s.ok('b', 'group_leave', {});
      expect((await s.state('b')).group).toBeNull();
    });

    it('a user who left waits 24 hours before joining any group', async () => {
      const s = await world();
      for (const id of ['a', 'b', 'c']) await s.user(id);
      const g = await s.group('a', ['b']);
      await s.ok('b', 'group_leave', {});
      expect((await s.state('b')).rejoinAt).toBe(s.clock.t + 24 * HOUR);
      expect(await s.fails('b', 'group_join', { code: g.inviteCode })).toBe('rejoin_cooldown');
      expect(await s.fails('b', 'group_create', { name: 'Mine', timezone: 'UTC' })).toBe('rejoin_cooldown');
      s.clock.t += 24 * HOUR + 1;
      expect(await s.fails('b', 'group_join', { code: g.inviteCode })).toBeNull();
    });

    it('members can visit each other and see the score; strangers cannot', async () => {
      const s = await world();
      await s.user('a', ['fox']);
      await s.user('b', ['unicorn', 'chick']);
      await s.user('c');
      await s.group('a', ['b']);
      const { snapshot } = await s.ok('a', 'get_island_snapshot', { userId: 'b' });
      expect(snapshot.score).toBe(points('unicorn') + points('chick'));
      expect(await s.fails('c', 'get_island_snapshot', { userId: 'b' })).toBe('not_friends');
    });

    it('ranks by island score with ties, and shows this week’s focus time', async () => {
      const s = await world();
      await s.user('a', ['chick', 'chick']);
      await s.user('b', ['unicorn']);
      await s.user('c', ['chick', 'chick']);
      await s.group('a', ['b', 'c']);
      const two = 2 * points('chick');
      const ranking = (await s.state('a')).group!.members.map((m) => [m.person.userId, m.rank, m.score.score]);
      expect(ranking).toEqual([
        ['b', 1, points('unicorn')],
        ['a', 2, two],
        ['c', 2, two],
      ]);
      await s.focus('c', 30);
      expect((await s.state('a')).group!.members.find((m) => m.person.userId === 'c')!.weekFocusMinutes).toBe(30);
    });

    it('mission: target frozen at week start, milestones paid once each to contributors', async () => {
      const s = await world();
      for (const id of ['a', 'b']) await s.user(id);
      await s.group('a', ['b']);
      // Created with 1 member: target as for 2 (600 min); b joined mid-week and does not raise it.
      let mission = (await s.state('a')).group!.mission;
      expect(mission).toMatchObject({ targetMinutes: 600, progressMinutes: 0 });
      await s.focus('b', 20); // below the 25-minute contribution threshold
      const before = await s.gold('b');
      await s.focus('a', 600); // crosses 50 % and 100 % in one session
      mission = (await s.state('a')).group!.mission;
      expect(mission.progressMinutes).toBe(620);
      expect(mission.milestones.map((m) => m.reached)).toEqual([true, true, false]);
      expect(await s.gold('b')).toBe(before); // b contributed too little
      const goldA = await s.gold('a');
      await s.focus('a', 30);
      expect(await s.gold('a')).toBe(goldA); // nothing paid twice
      await s.focus('b', 300); // 150 %: both now contributed enough
      expect((await s.state('a')).group!.mission.milestones.map((m) => m.reached)).toEqual([true, true, true]);
      expect(mission.contributions.map((c) => c.person.userId)).toEqual(['a', 'b']);
    });

    it('weekly settlement: eligible winner gets 50 gold and the flag, ties all win, idempotent', async () => {
      const s = await world();
      await s.user('a', ['unicorn']);
      await s.user('b', ['unicorn']);
      await s.user('c', ['fox']);
      await s.user('d', ['unicorn', 'unicorn']);
      await s.group('a', ['b', 'c']);
      // Week 1: everyone joined mid-week, so no one is eligible.
      s.clock.t = NEXT_MONDAY + HOUR;
      await runWeeklyJob(s.env);
      expect((await s.state('a')).group!.week.start).toBe('2026-11-02');
      expect(await s.gold('a')).toBe(0); // uploaded saves carry no starter gold here
      // Week 2: d joins mid-week (not eligible despite the best score); a and b tie on top.
      await s.ok('d', 'group_join', { code: (await s.state('a')).group!.inviteCode });
      s.clock.t = NEXT_MONDAY + 7 * DAY + HOUR;
      await runWeeklyJob(s.env);
      await runWeeklyJob(s.env); // a second run changes nothing
      expect([await s.gold('a'), await s.gold('b'), await s.gold('c'), await s.gold('d')]).toEqual([50, 50, foxGold, 0]); // c's fox left on its own after 7 days (Unicorns never do)
      const pullA = await s.ok('a', 'export_account', {});
      expect(pullA.rows.notices.filter((n) => n.notice.kind === 'weekly_result').map((n) => (n.notice as { youWon: boolean }).youWon)).toEqual([false, true]);
      const view = (await s.state('c')).group!;
      expect(view.members.filter((m) => m.champion).map((m) => m.person.userId).sort()).toEqual(['a', 'b']);
      const { snapshot } = await s.ok('c', 'get_island_snapshot', { userId: 'a' });
      expect(snapshot.championWeek).toBe('2026-11-09');
    });

    it('settles lazily on read, and gives nothing with fewer than 3 eligible members or a zero top score', async () => {
      const s = await world();
      await s.user('a', ['unicorn']);
      await s.user('b');
      await s.group('a', ['b']);
      s.clock.t = NEXT_MONDAY + 7 * DAY + HOUR;
      expect((await s.state('b')).group!.week.start).toBe('2026-11-09'); // two weeks settled on read
      expect(await s.gold('a')).toBe(0);
    });
  });
}
