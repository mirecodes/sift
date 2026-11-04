import type { IslandSnapshot, PersonView, RoomView } from '../../shared/api/types';
import { balance } from '../../shared/balance/balance';
import { DEFAULT_BLOCK_THEME } from '../../src/domain/config';
import { goldPileLevel } from '../../src/domain/economy/ledger';
import { islandLevel } from '../../src/domain/island/level';
import { ApiError, type HandlerCtx } from './context';
import type { Tx } from './db';
import type { ProfileRow, TogetherRoomRow } from './schema';
import { focusingNow, strip, userState } from './user';

const DAY = 86_400_000;

/** Key of the friendship row of two users (order-free). */
export const pairOf = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export async function areFriends(tx: Tx, a: string, b: string): Promise<boolean> {
  return (await tx.table('friendships').get(pairOf(a, b)))?.status === 'accepted';
}

/** Either side blocked the other (Step 7.2): no requests, invites, presence or visits either way. */
export async function blockedEither(tx: Tx, a: string, b: string): Promise<boolean> {
  return (await tx.table('blocks').get(`${a}|${b}`)) !== undefined || (await tx.table('blocks').get(`${b}|${a}`)) !== undefined;
}

/** Other ways two users are related; Phase 8 adds "members of the same group". */
type Relation = (tx: Tx, a: string, b: string) => Promise<boolean>;
const relations: Relation[] = [areFriends];
export const addRelation = (relation: Relation): void => void relations.push(relation);

/** Friends or members of the same group, and neither blocked the other (Steps 7.4, 7.6). */
export async function related(tx: Tx, a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  if (await blockedEither(tx, a, b)) return false;
  for (const r of relations) if (await r(tx, a, b)) return true;
  return false;
}

/** Friendship rows of a user, split by state. */
export async function friendRows(tx: Tx, userId: string) {
  const rows = [...(await tx.table('friendships').find({ userLow: userId })), ...(await tx.table('friendships').find({ userHigh: userId }))].sort((x, y) => x.createdAt - y.createdAt);
  const other = (r: { userLow: string; userHigh: string }) => (r.userLow === userId ? r.userHigh : r.userLow);
  return {
    accepted: rows.filter((r) => r.status === 'accepted').map(other),
    incoming: rows.filter((r) => r.status === 'pending' && r.requestedBy !== userId).map(other),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requestedBy === userId).map(other),
  };
}

/** The signed-in user must have chosen a name before Friends or Group (Step 7.1). */
export async function requireHandle(c: HandlerCtx): Promise<ProfileRow> {
  const me = await c.w.profile();
  if (!me.handleName || !me.handleTag) throw new ApiError('handle_required');
  return me;
}

/**
 * How one user appears to another. `presence` only for related users: "Focusing now" shows only when
 * they share it (`showPresence`) and nobody blocked anybody (Step 7.6).
 */
export async function personView(tx: Tx, viewerId: string, userId: string, now: number, presence: boolean): Promise<PersonView> {
  const p = await tx.table('profiles').get(userId);
  let avatar = p?.avatarSpeciesId ?? null;
  if (!avatar) {
    const active = await tx.table('animals').find({ userId, status: 'active' });
    avatar = active.sort((a, b) => b.acquiredAt - a.acquiredAt)[0]?.speciesId ?? null;
  }
  const focusing = presence && !!p?.showPresence && !(await blockedEither(tx, viewerId, userId)) && (await focusingNow(tx, userId, now));
  return { userId, handle: p?.handleName && p.handleTag ? { name: p.handleName, tag: p.handleTag } : null, avatarSpeciesId: avatar, focusing };
}

/** What a visitor sees of someone's island (Step 7.4). */
export async function islandSnapshot(tx: Tx, userId: string): Promise<IslandSnapshot> {
  const [state, all, profile] = await Promise.all([userState(tx, userId), tx.table('animals').find({ userId }), tx.table('profiles').get(userId)]);
  return {
    userId,
    handle: profile?.handleName && profile.handleTag ? { name: profile.handleName, tag: profile.handleTag } : null,
    world: state.island ? { seed: state.island.seed, blockThemeId: state.island.blockThemeId } : { seed: 0, blockThemeId: DEFAULT_BLOCK_THEME },
    level: islandLevel(all.map(strip)),
    animals: state.animals.filter((a) => a.status === 'active'),
    buildings: state.buildings,
    equipped: state.equipped,
    goldPileLevel: goldPileLevel(state.gold, balance.economy.pileThresholds),
    championWeek: state.island?.championWeek ?? null,
  };
}

/** Records a visit: at most one row per visitor per host per day (Step 7.5). */
export async function recordVisit(tx: Tx, hostId: string, visitorId: string, now: number): Promise<void> {
  const key = `${hostId}|${visitorId}|${Math.floor(now / DAY)}`;
  if (await tx.table('visits').get(key)) return;
  await tx.table('visits').put({ key, hostId, visitorId, at: now, traceKind: 'basic', tracePayload: {} });
}

/** Visits older than the retention window (the hourly job drops them). */
export const visitExpired = (at: number, now: number): boolean => now - at > balance.social.visitRetentionDays * DAY;

// --- Focus together (Step 7.7) ---

const MIN = 60_000;
/** Starting within this of the room start counts as on time: the shared start applies. */
export const ON_TIME_MS = 30_000;

/** Closes a lobby that was never started in time (rooms expire lazily, when read). */
export async function settleRoom(tx: Tx, room: TogetherRoomRow, now: number): Promise<TogetherRoomRow> {
  if (room.status === 'lobby' && now > room.createdAt + balance.together.lobbyMinutes * MIN) {
    const closed = { ...room, status: 'closed' as const };
    await tx.table('together_rooms').put(closed);
    return closed;
  }
  return room;
}

export async function roomView(tx: Tx, room: TogetherRoomRow, viewerId: string, now: number): Promise<RoomView> {
  const rows = (await tx.table('together_participants').find({ roomId: room.id })).sort((a, b) => (a.userId === room.hostId ? -1 : b.userId === room.hostId ? 1 : a.invitedAt - b.invitedAt));
  const participants: RoomView['participants'] = [];
  for (const p of rows) {
    const session = (await tx.table('sessions').find({ userId: p.userId })).filter((s) => s.togetherRoomId === room.id).sort((a, b) => b.startedAt - a.startedAt)[0];
    let state: RoomView['participants'][number]['state'] = p.state;
    if (session) state = session.status === 'running' ? 'focusing' : session.status === 'completed' ? 'done' : 'stopped';
    let animal: RoomView['participants'][number]['animal'] = null;
    if (session?.rewardAnimalId) {
      const a = await tx.table('animals').get(session.rewardAnimalId);
      if (a) animal = { speciesId: a.speciesId, tierRank: a.tierRank, ...(a.skinId && { skinId: a.skinId }) };
    }
    participants.push({ person: await personView(tx, viewerId, p.userId, now, false), state, animal });
  }
  return { id: room.id, hostId: room.hostId, plannedMs: room.plannedMs, status: room.status, createdAt: room.createdAt, startedAt: room.startedAt, participants };
}

/**
 * The start of a together session (`start_session(roomId)`): the room's server start for everyone on
 * time; a late joiner (within `lateJoinMinutes`) starts now with the room's remaining time, so all end
 * together.
 */
export async function togetherTiming(c: HandlerCtx, roomId: string): Promise<{ startedAt: number; plannedMs: number }> {
  const room = await c.tx.table('together_rooms').get(roomId);
  const me = await c.tx.table('together_participants').get(`${roomId}|${c.userId}`);
  if (!room || !me || me.state !== 'joined' || room.status !== 'started' || room.startedAt === null) throw new ApiError('room_closed');
  const late = c.now - room.startedAt;
  if (late > balance.together.lateJoinMinutes * MIN) throw new ApiError('room_closed');
  if (late <= ON_TIME_MS) return { startedAt: room.startedAt, plannedMs: room.plannedMs };
  return { startedAt: c.now, plannedMs: room.startedAt + room.plannedMs - c.now };
}

/** Removes a deleted account from everyone else's social rows (Step 5.4). */
export async function deleteSocialRows(tx: Tx, userId: string): Promise<void> {
  for (const r of [...(await tx.table('friendships').find({ userLow: userId })), ...(await tx.table('friendships').find({ userHigh: userId }))]) await tx.table('friendships').delete(r.pair);
  for (const r of [...(await tx.table('blocks').find({ blocker: userId })), ...(await tx.table('blocks').find({ blocked: userId }))]) await tx.table('blocks').delete(r.pair);
  for (const r of [...(await tx.table('visits').find({ hostId: userId })), ...(await tx.table('visits').find({ visitorId: userId }))]) await tx.table('visits').delete(r.key);
  for (const r of await tx.table('together_participants').find({ userId })) await tx.table('together_participants').delete(r.key);
}
