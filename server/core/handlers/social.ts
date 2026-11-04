import { balance } from '../../../shared/balance/balance';
import { formatTag, handleKey, nameProblem, normalizeName } from '../../../shared/rules/handle';
import { ApiError, type HandlerCtx } from '../context';
import { nameAllowed } from '../moderation';
import {
  blockedEither,
  friendRows,
  islandSnapshot,
  pairOf,
  personView,
  recordVisit,
  related,
  requireHandle,
  roomView,
  settleRoom,
  visitExpired,
} from '../social';
import { notify, profileView } from '../user';
import { memberScore, membership } from '../groups';
import type { Handlers } from './core';

const DAY = 86_400_000;
const MIN = 60_000;

/** A random free tag for a name key, or null when all 9,999 are taken. */
async function freeTag(c: HandlerCtx, key: string): Promise<string | null> {
  const taken = new Set((await c.tx.table('profiles').find({ handleKey: key })).map((p) => p.handleTag));
  for (let i = 0; i < 40; i++) {
    const tag = formatTag(1 + Math.floor(c.env.random() * 9999));
    if (!taken.has(tag)) return tag;
  }
  for (let n = 1; n <= 9999; n++) if (!taken.has(formatTag(n))) return formatTag(n);
  return null;
}

async function room(c: HandlerCtx, roomId: string) {
  const found = await c.tx.table('together_rooms').get(roomId);
  const me = found && (await c.tx.table('together_participants').get(`${roomId}|${c.userId}`));
  if (!found || !me) throw new ApiError('not_found');
  return { room: await settleRoom(c.tx, found, c.now), me };
}

/** Phase 7 operations (guidance_v2 Steps 7.1–7.7). */
export const socialHandlers: Handlers = {
  async social_state(c) {
    const me = await c.w.profile();
    const rows = await friendRows(c.tx, c.userId);
    const view = (id: string, presence: boolean) => personView(c.tx, c.userId, id, c.now, presence);
    const visits = (await c.tx.table('visits').find({ hostId: c.userId })).filter((v) => !visitExpired(v.at, c.now));
    const latest = new Map<string, number>();
    for (const v of visits) latest.set(v.visitorId, Math.max(latest.get(v.visitorId) ?? 0, v.at));
    const visitors: { person: Awaited<ReturnType<typeof view>>; at: number }[] = [];
    for (const [id, at] of [...latest].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      if (await blockedEither(c.tx, c.userId, id)) continue;
      visitors.push({ person: await view(id, false), at });
    }
    return {
      me: profileView(me),
      friends: await Promise.all(rows.accepted.map((id) => view(id, true))),
      incoming: await Promise.all(rows.incoming.map((id) => view(id, false))),
      outgoing: await Promise.all(rows.outgoing.map((id) => view(id, false))),
      blocked: await Promise.all((await c.tx.table('blocks').find({ blocker: c.userId })).map((b) => view(b.blocked, false))),
      visitors,
      visitCount: visits.length,
    };
  },

  /** Step 7.1: the name rule, the word filter, the cooldown, and a tag kept when free. */
  async set_handle(c, args) {
    const name = normalizeName(args.name);
    if (nameProblem(name) || !nameAllowed(name)) throw new ApiError('handle_invalid');
    const me = await c.w.profile();
    const key = handleKey(name);
    if (me.handleName === name) return { profile: profileView(me) };
    const changing = me.handleName !== null;
    if (changing && me.nameChangedAt !== null && c.now - me.nameChangedAt < balance.identity.nameChangeCooldownDays * DAY) throw new ApiError('name_change_cooldown');
    const keepTag = me.handleTag && !(await c.tx.table('profiles').find({ handleKey: key, handleTag: me.handleTag })).some((p) => p.userId !== c.userId);
    const tag = keepTag ? me.handleTag : await freeTag(c, key);
    if (!tag) throw new ApiError('handle_taken');
    // The first choice is free to correct once: the cooldown starts with the first change.
    const next = { ...me, handleName: name, handleKey: key, handleTag: tag, nameChangedAt: changing ? c.now : null };
    await c.tx.table('profiles').put(next);
    return { profile: profileView(next) };
  },

  /** Step 7.3: exact handle only; a request waiting the other way is accepted; blocks look like "not found". */
  async friend_request(c, args) {
    await requireHandle(c);
    const [target] = await c.tx.table('profiles').find({ handleKey: handleKey(args.name), handleTag: args.tag });
    if (!target || target.userId === c.userId || (await blockedEither(c.tx, c.userId, target.userId))) throw new ApiError('not_found');
    const pair = pairOf(c.userId, target.userId);
    const existing = await c.tx.table('friendships').get(pair);
    const person = () => personView(c.tx, c.userId, target.userId, c.now, existing?.status === 'accepted');
    if (existing?.status === 'accepted') return { status: 'accepted' as const, person: await person() };
    if (existing?.requestedBy === c.userId) return { status: 'pending' as const, person: await person() };
    const full = async (id: string) => (await friendRows(c.tx, id)).accepted.length >= balance.social.maxFriends;
    if ((await full(c.userId)) || (await full(target.userId))) throw new ApiError('friend_limit');
    const other = await c.writerFor(target.userId);
    if (existing) {
      await c.tx.table('friendships').put({ ...existing, status: 'accepted', acceptedAt: c.now });
      await notify(other, c.env.uuid(), c.now, { kind: 'friend_accepted', userId: c.userId });
      return { status: 'accepted' as const, person: await personView(c.tx, c.userId, target.userId, c.now, true) };
    }
    const [userLow, userHigh] = c.userId < target.userId ? [c.userId, target.userId] : [target.userId, c.userId];
    await c.tx.table('friendships').put({ pair, userLow, userHigh, status: 'pending', requestedBy: c.userId, createdAt: c.now, acceptedAt: null });
    await notify(other, c.env.uuid(), c.now, { kind: 'friend_request', userId: c.userId });
    return { status: 'pending' as const, person: await person() };
  },

  async friend_respond(c, args) {
    const row = await c.tx.table('friendships').get(pairOf(c.userId, args.userId));
    if (!row || row.status !== 'pending' || row.requestedBy !== args.userId) throw new ApiError('not_found');
    if (!args.accept) {
      await c.tx.table('friendships').delete(row.pair);
      return {};
    }
    if ((await friendRows(c.tx, c.userId)).accepted.length >= balance.social.maxFriends) throw new ApiError('friend_limit');
    await c.tx.table('friendships').put({ ...row, status: 'accepted', acceptedAt: c.now });
    await notify(await c.writerFor(args.userId), c.env.uuid(), c.now, { kind: 'friend_accepted', userId: c.userId });
    return {};
  },

  async friend_cancel(c, args) {
    const row = await c.tx.table('friendships').get(pairOf(c.userId, args.userId));
    if (row?.status === 'pending' && row.requestedBy === c.userId) await c.tx.table('friendships').delete(row.pair);
    return {};
  },

  async friend_remove(c, args) {
    const row = await c.tx.table('friendships').get(pairOf(c.userId, args.userId));
    if (row?.status === 'accepted') await c.tx.table('friendships').delete(row.pair);
    return {};
  },

  /** Step 7.2: removes any friendship and rejects what follows; group membership is the owner's call. */
  async block_user(c, args) {
    if (args.userId === c.userId) throw new ApiError('invalid');
    await c.tx.table('blocks').put({ pair: `${c.userId}|${args.userId}`, blocker: c.userId, blocked: args.userId, createdAt: c.now });
    await c.tx.table('friendships').delete(pairOf(c.userId, args.userId));
    return {};
  },

  async unblock_user(c, args) {
    await c.tx.table('blocks').delete(`${c.userId}|${args.userId}`);
    return {};
  },

  async report_user(c, args) {
    if (args.userId === c.userId || !(await c.tx.table('profiles').get(args.userId))) throw new ApiError('not_found');
    await c.tx.table('reports').put({ id: c.env.uuid(), reporterId: c.userId, reportedId: args.userId, reason: args.reason, note: args.note ?? '', context: args.context, createdAt: c.now });
    return {};
  },

  /** Step 7.4: friends or the same group, neither blocked. Score is added for group members (Phase 8). */
  async get_island_snapshot(c, args) {
    if (!(await c.tx.table('profiles').get(args.userId))) throw new ApiError('not_found');
    if (await blockedEither(c.tx, c.userId, args.userId)) throw new ApiError('blocked');
    if (!(await related(c.tx, c.userId, args.userId))) throw new ApiError('not_friends');
    if (args.userId !== c.userId) await recordVisit(c.tx, args.userId, c.userId, c.now);
    const snapshot = await islandSnapshot(c.tx, args.userId);
    // Score only between members of the same group (Step 7.4).
    const mine = await membership(c.tx, c.userId);
    const group = mine && (await membership(c.tx, args.userId))?.groupId === mine.groupId ? await c.tx.table('groups').get(mine.groupId) : undefined;
    if (group) snapshot.score = (await memberScore(c.tx, args.userId, group, c.now)).score;
    return { snapshot };
  },

  /** Step 7.7: a lobby with the host's focus length; invitees get a notice (push when not focusing). */
  async together_create(c, args) {
    await requireHandle(c);
    const { focusMinutes } = balance.timer;
    if (args.plannedMs < focusMinutes.min * MIN || args.plannedMs > focusMinutes.max * MIN) throw new ApiError('invalid');
    const invitees = [...new Set(args.invitees)].filter((id) => id !== c.userId);
    if (!invitees.length || invitees.length + 1 > balance.together.maxParticipants) throw new ApiError('invalid');
    for (const id of invitees) if (!(await related(c.tx, c.userId, id))) throw new ApiError('not_friends');
    const id = c.env.uuid();
    const row = { id, hostId: c.userId, plannedMs: args.plannedMs, status: 'lobby' as const, createdAt: c.now, startedAt: null };
    await c.tx.table('together_rooms').put(row);
    await c.tx.table('together_participants').put({ key: `${id}|${c.userId}`, roomId: id, userId: c.userId, state: 'joined', invitedAt: c.now, joinedAt: c.now });
    for (const [i, userId] of invitees.entries()) {
      await c.tx.table('together_participants').put({ key: `${id}|${userId}`, roomId: id, userId, state: 'invited', invitedAt: c.now + i + 1, joinedAt: null });
      await notify(await c.writerFor(userId), c.env.uuid(), c.now, { kind: 'together_invite', roomId: id, hostId: c.userId });
    }
    return { room: await roomView(c.tx, row, c.userId, c.now) };
  },

  async together_room(c, args) {
    const { room: r } = await room(c, args.roomId);
    return { room: await roomView(c.tx, r, c.userId, c.now) };
  },

  /** Joining in the lobby, or late within `lateJoinMinutes` after the start. */
  async together_join(c, args) {
    const { room: r, me } = await room(c, args.roomId);
    const late = r.status === 'started' && r.startedAt !== null && c.now - r.startedAt <= balance.together.lateJoinMinutes * MIN;
    if (r.status !== 'lobby' && !late) throw new ApiError('room_closed');
    if (me.state !== 'joined') await c.tx.table('together_participants').put({ ...me, state: 'joined', joinedAt: c.now });
    return { room: await roomView(c.tx, r, c.userId, c.now) };
  },

  /** Leaving the lobby (or the room). The host leaving a lobby closes it. */
  async together_leave(c, args) {
    let { room: r, me } = await room(c, args.roomId);
    await c.tx.table('together_participants').put({ ...me, state: 'left' });
    if (r.hostId === c.userId && r.status === 'lobby') {
      r = { ...r, status: 'closed' };
      await c.tx.table('together_rooms').put(r);
    }
    return { room: await roomView(c.tx, r, c.userId, c.now) };
  },

  /** The host starts: one server start time for everyone who joined. */
  async together_start(c, args) {
    const { room: r } = await room(c, args.roomId);
    if (r.hostId !== c.userId) throw new ApiError('not_owner');
    if (r.status === 'started') return { room: await roomView(c.tx, r, c.userId, c.now) };
    if (r.status !== 'lobby') throw new ApiError('room_closed');
    const started = { ...r, status: 'started' as const, startedAt: c.now };
    await c.tx.table('together_rooms').put(started);
    return { room: await roomView(c.tx, started, c.userId, c.now) };
  },
};
