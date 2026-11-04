import { API_VERSION, type Op, type OpArgs } from '../../../shared/api/types';
import { seededRng } from '../../../shared/rng';
import { BALANCE_VERSION } from '../../../shared/balance/balance';
import { missionTarget } from '../../../shared/rules/missions';
import { attackArmy } from '../../../shared/rules/war';
import { previousWeek, weekOf } from '../../../shared/rules/week';
import { handle } from '../../../server/core/api';
import { UserWriter } from '../../../server/core/context';
import { pairOf } from '../../../server/core/social';
import { getSpecies } from '../../domain/animals/catalog';
import { newPlacedAnimal } from '../../domain/animals/placed';
import { pickNewAnimalTile } from '../../domain/island/level';
import type { PlacedAnimal } from '../../domain/types';
import type { FakeRemote } from './fake';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** [user id, name, island seed, species]. */
const BOTS: [string, string, number, string[]][] = [
  ['bot-minji', '민지', 11, ['fox', 'cat', 'unicorn', 'panda', 'chick']],
  ['bot-jae', 'Jae', 22, ['dog', 'chick', 'fox']],
  ['bot-sora', '소라', 33, ['panda', 'cat', 'dog', 'fox', 'chick', 'cat']],
  ['bot-leo', 'Leo', 44, ['chick', 'dog']],
];

/**
 * Sample friends for the test backend (`testMode.dummyData` with `backend.provider: fake`, dev builds only,
 * ADR-038): four bot accounts with islands; three are the signed-in user's friends (민지 is focusing now,
 * Jae visited), Leo has sent a request. Written into the fake server, so every screen shows real data.
 */
export async function seedFakeSocial(fake: FakeRemote, userId: string): Promise<void> {
  const env = fake.env;
  const now = env.now();
  let n = 0;
  const as = <O extends Op>(uid: string, op: O, args: OpArgs<O>) =>
    handle(env, { userId: uid, platform: 'web', appVersion: '0.0.0', apiVersion: API_VERSION }, { op, args, requestId: `${uid}-${op}-${now}-${++n}` });

  for (const [id, name, seed, species] of BOTS) {
    if (await env.db.transaction((tx) => tx.table('profiles').get(id))) continue;
    await as(id, 'set_handle', { name });
    const rng = seededRng(seed);
    const animals: PlacedAnimal[] = [];
    species.forEach((s, i) => {
      const tile = pickNewAnimalTile(seed, animals, rng);
      if (tile) animals.push(newPlacedAnimal(`${id}-a${i}`, getSpecies(s), tile, now - (i + 1) * 5 * HOUR, `${id}-s${i}`));
    });
    await as(id, 'upload_local_save', {
      replace: false,
      save: {
        world: { seed, blockThemeId: 'default' },
        animals,
        sessions: animals.map((a) => ({ id: a.sessionId, startedAt: a.acquiredAt - 30 * MIN, plannedFocusMs: 25 * MIN, endedAt: a.acquiredAt, effectiveFocusMs: 30 * MIN, status: 'completed' as const, rewardAnimalId: a.id, togetherRoomId: null })),
        ledger: [{ id: `${id}-gold`, at: now - 24 * HOUR, currency: 'gold', amount: 40 + seed, reason: 'starter', refId: null }],
        cosmetics: [],
        placedBuildings: [],
        islandHistory: [],
      },
    });
  }
  // 민지 is focusing right now (presence); started 10 minutes ago if not already.
  await as('bot-minji', 'start_session', { plannedMs: 25 * MIN, sessionId: `bot-minji-live-${Math.floor(now / (25 * MIN))}` });

  await env.db.transaction(async (tx) => {
    const link = async (other: string, status: 'accepted' | 'pending') => {
      const pair = pairOf(userId, other);
      if (await tx.table('friendships').get(pair)) return;
      const [userLow, userHigh] = userId < other ? [userId, other] : [other, userId];
      await tx.table('friendships').put({ pair, userLow, userHigh, status, requestedBy: other, createdAt: now - HOUR, acceptedAt: status === 'accepted' ? now - HOUR : null });
    };
    await link('bot-minji', 'accepted');
    await link('bot-jae', 'accepted');
    await link('bot-sora', 'accepted');
    await link('bot-leo', 'pending');
    const day = Math.floor((now - 2 * HOUR) / (24 * HOUR));
    await tx.table('visits').put({ key: `${userId}|bot-jae|${day}`, hostId: userId, visitorId: 'bot-jae', at: now - 2 * HOUR, traceKind: 'basic', tracePayload: {} });
  });

  // Phase 8: 민지's group (with Jae, 소라, Leo), last week's champion 소라, some mission progress, and an
  // invite for the user from 민지.
  const groupId = 'bot-group';
  if (!(await env.db.transaction((tx) => tx.table('groups').get(groupId)))) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const week = weekOf(now, timezone);
    await env.db.transaction(async (tx) => {
      await tx.table('groups').put({ id: groupId, name: 'Morning Owls', ownerId: 'bot-minji', inviteCode: 'OWLS2026', inviteCodeEnabled: true, timezone, warEnabled: true, createdAt: now - 30 * 24 * HOUR, week, championIds: ['bot-sora'], championWeek: previousWeek(week) });
      for (const [i, id] of ['bot-minji', 'bot-jae', 'bot-sora', 'bot-leo'].entries()) {
        await tx.table('group_members').put({ userId: id, groupId, role: i === 0 ? 'owner' : 'member', joinedAt: now - (30 - i) * 24 * HOUR });
        await tx.table('group_mission_contributions').put({ key: `${groupId}|${week}|${id}`, groupId, weekStart: week, userId: id, minutes: [180, 95, 240, 30][i]! });
      }
      await tx.table('group_mission_weeks').put({ key: `${groupId}|${week}`, groupId, weekStart: week, kind: 'focusMinutes', memberCount: 4, targetMinutes: missionTarget(4), progressMinutes: 545, milestonesReached: [0], balanceVersion: BALANCE_VERSION });
    });
  }
  const invited = await env.db.transaction(async (tx) => (await tx.table('group_invites').find({ inviteeId: userId })).length > 0);
  const member = await env.db.transaction((tx) => tx.table('group_members').get(userId));
  if (!invited && !member) await env.db.transaction((tx) => tx.table('group_invites').put({ id: `bot-invite-${userId}`, groupId, inviterId: 'bot-minji', inviteeId: userId, status: 'pending', createdAt: now - HOUR }));
}

/** Every tier once or more; the Unicorn stays home in wars and pays for an island move. */
const TEST_ARMY = ['tiger', 'wolf', 'peacock', 'fox', 'cat', 'owl', 'dog', 'chick', 'unicorn'];

/**
 * Test tools (Settings › Test tools, dev builds with the fake backend). Each writes straight into the fake
 * server; the app then pulls the change like any other.
 */
export const testTools = {
  /** What the test server holds for the user (Settings › Test tools › Server check). */
  async status(fake: FakeRemote, userId: string) {
    return fake.env.db.transaction(async (tx) => {
      const animals = await tx.table('animals').find({ userId });
      const active = animals.filter((a) => a.status === 'active');
      return {
        island: !!(await tx.table('island_state').get(userId)),
        group: (await tx.table('group_members').get(userId))?.groupId ?? null,
        active: active.length,
        verified: active.filter((a) => a.verified).length,
        canFight: attackArmy(animals.map(({ userId: _u, updatedSeq: _s, ...a }) => a)).length,
      };
    });
  },

  /** Verified animals on the user's island, so they can attack (and move the island) without focusing. */
  async grantArmy(fake: FakeRemote, userId: string): Promise<{ added: number } | 'no_island'> {
    const env = fake.env;
    const now = env.now();
    return env.db.transaction(async (tx) => {
      const island = await tx.table('island_state').get(userId);
      if (!island) return 'no_island';
      const animals: PlacedAnimal[] = (await tx.table('animals').find({ userId })).map(({ userId: _u, updatedSeq: _s, ...a }) => a);
      const buildings = (await tx.table('placed_buildings').find({ userId })).filter((b) => !b.deleted).map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation }));
      const w = new UserWriter(tx, userId);
      const rng = seededRng(now);
      let added = 0;
      for (const [i, s] of TEST_ARMY.entries()) {
        const tile = pickNewAnimalTile(island.seed, animals, rng, buildings);
        if (!tile) break;
        const id = `test-${now}-${i}`;
        const animal = newPlacedAnimal(id, getSpecies(s), tile, now - (i + 1) * MIN, `${id}-s`);
        animals.push(animal);
        await w.put('sessions', { id: animal.sessionId, startedAt: animal.acquiredAt - 30 * MIN, plannedFocusMs: 25 * MIN, endedAt: animal.acquiredAt, effectiveFocusMs: 30 * MIN, status: 'completed', rewardAnimalId: id, togetherRoomId: null, verified: true });
        await w.put('animals', animal);
        added++;
      }
      await w.finish();
      return { added };
    });
  },

  /**
   * Moves every war clock of the user's group back a day, and the user's group join two days: cooldowns,
   * shields and new-member protection end now (the hour before the weekly settlement still blocks).
   */
  async resetWarTimers(fake: FakeRemote, userId: string): Promise<void> {
    const env = fake.env;
    const now = env.now();
    await env.db.transaction(async (tx) => {
      const member = await tx.table('group_members').get(userId);
      if (!member) return;
      for (const war of await tx.table('wars').find({ groupId: member.groupId }))
        await tx.table('wars').put({ ...war, createdAt: Math.min(war.createdAt, now - 25 * HOUR) });
      const profile = await tx.table('profiles').get(userId);
      if (profile?.joinedGroupAt) await tx.table('profiles').put({ ...profile, joinedGroupAt: Math.min(profile.joinedGroupAt, now - 49 * HOUR) });
    });
  },

  /** A sample friend in the user's group attacks them (the defender's side: notice, losses, replay). */
  async botAttack(fake: FakeRemote, userId: string): Promise<'ok' | 'no_group' | 'no_bot' | string> {
    const env = fake.env;
    const member = await env.db.transaction((tx) => tx.table('group_members').get(userId));
    if (!member) return 'no_group';
    const bots = await env.db.transaction(async (tx) => (await tx.table('group_members').find({ groupId: member.groupId })).map((m) => m.userId).filter((id) => id.startsWith('bot-')));
    if (!bots.length) return 'no_bot';
    await testTools.resetWarTimers(fake, userId);
    const bot = bots[Math.floor(env.random() * bots.length)]!;
    const res = await handle(env, { userId: bot, platform: 'web', appVersion: '0.0.0', apiVersion: API_VERSION }, { op: 'declare_war', args: { targetId: userId }, requestId: `${bot}-war-${env.now()}` });
    return res.ok ? 'ok' : res.error.code;
  },
};
