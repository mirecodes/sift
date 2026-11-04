import { API_VERSION, type Op, type OpArgs } from '../../../shared/api/types';
import { seededRng } from '../../../shared/rng';
import { BALANCE_VERSION } from '../../../shared/balance/balance';
import { missionTarget } from '../../../shared/rules/missions';
import { previousWeek, weekOf } from '../../../shared/rules/week';
import { handle } from '../../../server/core/api';
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
