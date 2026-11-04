import { balance } from '../../../shared/balance/balance';
import { groupNameProblem, normalizeGroupName } from '../../../shared/rules/handle';
import { isTimeZone, weekOf } from '../../../shared/rules/week';
import { ApiError, type HandlerCtx } from '../context';
import { DuplicateKeyError } from '../db';
import { groupView, logMembership, membersOf, membership, missionWeek, newInviteCode, rejoinAt, settleDueWeeks } from '../groups';
import { nameAllowed } from '../moderation';
import type { GroupRow } from '../schema';
import { personView, related, requireHandle } from '../social';
import { notify } from '../user';
import type { Handlers } from './core';

function checkName(name: string): string {
  const clean = normalizeGroupName(name);
  if (groupNameProblem(clean) || !nameAllowed(clean)) throw new ApiError('handle_invalid');
  return clean;
}

/** The caller's group, settled up to now; `not_in_group` when there is none. */
async function myGroup(c: HandlerCtx): Promise<GroupRow> {
  const m = await membership(c.tx, c.userId);
  const g = m && (await c.tx.table('groups').get(m.groupId));
  if (!g) throw new ApiError('not_in_group');
  return settleDueWeeks(c, g);
}

async function ownGroup(c: HandlerCtx): Promise<GroupRow> {
  const g = await myGroup(c);
  if (g.ownerId !== c.userId) throw new ApiError('not_owner');
  return g;
}

/** Joining: one group per user, the rejoin cooldown, the size limit; tells the members (push `groups`). */
async function join(c: HandlerCtx, group: GroupRow): Promise<void> {
  if (await membership(c.tx, c.userId)) throw new ApiError('already_in_group');
  if (await rejoinAt(c.tx, c.userId, c.now)) throw new ApiError('rejoin_cooldown');
  const members = await membersOf(c.tx, group.id);
  if (members.length >= balance.social.maxGroupSize) throw new ApiError('group_full');
  await c.tx.table('group_members').put({ userId: c.userId, groupId: group.id, role: 'member', joinedAt: c.now });
  await logMembership(c, group.id, c.userId, 'join');
  const me = await c.w.profile();
  await c.tx.table('profiles').put({ ...me, joinedGroupAt: c.now });
  for (const m of members) await notify(await c.writerFor(m.userId), c.env.uuid(), c.now, { kind: 'joined_group', groupId: group.id, userId: c.userId });
  for (const inv of await c.tx.table('group_invites').find({ inviteeId: c.userId })) if (inv.status === 'pending') await c.tx.table('group_invites').put({ ...inv, status: inv.groupId === group.id ? 'accepted' : 'declined' });
}

async function removeMember(c: HandlerCtx, group: GroupRow, userId: string, kind: 'leave' | 'removed'): Promise<void> {
  await c.tx.table('group_members').delete(userId);
  await logMembership(c, group.id, userId, kind);
  if (kind === 'removed') await notify(await c.writerFor(userId), c.env.uuid(), c.now, { kind: 'removed_from_group', groupId: group.id });
}

async function disband(c: HandlerCtx, group: GroupRow): Promise<void> {
  for (const m of await membersOf(c.tx, group.id)) {
    await c.tx.table('group_members').delete(m.userId);
    // The owner who disbands waits like someone who left; the others may join another group at once.
    await logMembership(c, group.id, m.userId, m.userId === c.userId ? 'disband' : 'removed');
    if (m.userId !== c.userId) await notify(await c.writerFor(m.userId), c.env.uuid(), c.now, { kind: 'removed_from_group', groupId: group.id });
  }
  await c.tx.table('groups').delete(group.id);
}

/** Phase 8 operations (guidance_v2 Steps 8.1–8.6). */
export const groupHandlers: Handlers = {
  async group_state(c) {
    const m = await membership(c.tx, c.userId);
    const found = m && (await c.tx.table('groups').get(m.groupId));
    const group = found ? await settleDueWeeks(c, found) : null;
    const invites = [];
    for (const inv of await c.tx.table('group_invites').find({ inviteeId: c.userId })) {
      const g = inv.status === 'pending' && (await c.tx.table('groups').get(inv.groupId));
      if (!g) continue;
      invites.push({ id: inv.id, groupId: g.id, groupName: g.name, memberCount: (await membersOf(c.tx, g.id)).length, inviter: await personView(c.tx, c.userId, inv.inviterId, c.now, false) });
    }
    return { group: group && (await groupView(c.tx, group, c.userId, c.now)), invites, rejoinAt: await rejoinAt(c.tx, c.userId, c.now) };
  },

  async group_create(c, args) {
    await requireHandle(c);
    const name = checkName(args.name);
    if (!isTimeZone(args.timezone)) throw new ApiError('invalid');
    if (await membership(c.tx, c.userId)) throw new ApiError('already_in_group');
    if (await rejoinAt(c.tx, c.userId, c.now)) throw new ApiError('rejoin_cooldown');
    const group: GroupRow = {
      id: c.env.uuid(),
      name,
      ownerId: c.userId,
      inviteCode: newInviteCode(c.env.random),
      inviteCodeEnabled: true,
      timezone: args.timezone,
      warEnabled: true,
      createdAt: c.now,
      week: weekOf(c.now, args.timezone),
      championIds: [],
      championWeek: null,
    };
    await c.tx.table('groups').insert(group);
    await c.tx.table('group_members').put({ userId: c.userId, groupId: group.id, role: 'owner', joinedAt: c.now });
    await logMembership(c, group.id, c.userId, 'join');
    await c.tx.table('profiles').put({ ...(await c.w.profile()), joinedGroupAt: c.now });
    await missionWeek(c, group, group.week);
    return { group: await groupView(c.tx, group, c.userId, c.now) };
  },

  async group_rename(c, args) {
    const g = await ownGroup(c);
    await c.tx.table('groups').put({ ...g, name: checkName(args.name) });
    return {};
  },

  /** In-app invite from the friend list (Step 8.1); accepted in the Group tab or from the notice. */
  async group_invite(c, args) {
    await requireHandle(c);
    const g = await myGroup(c);
    if (!(await related(c.tx, c.userId, args.userId))) throw new ApiError('not_friends');
    if ((await membership(c.tx, args.userId))?.groupId === g.id) return {};
    const pending = (await c.tx.table('group_invites').find({ inviteeId: args.userId })).some((i) => i.groupId === g.id && i.status === 'pending');
    if (pending) return {};
    await c.tx.table('group_invites').put({ id: c.env.uuid(), groupId: g.id, inviterId: c.userId, inviteeId: args.userId, status: 'pending', createdAt: c.now });
    await notify(await c.writerFor(args.userId), c.env.uuid(), c.now, { kind: 'group_invite', groupId: g.id, inviterId: c.userId });
    return {};
  },

  async group_invite_respond(c, args) {
    const inv = await c.tx.table('group_invites').get(args.inviteId);
    if (!inv || inv.inviteeId !== c.userId || inv.status !== 'pending') throw new ApiError('not_found');
    if (!args.accept) {
      await c.tx.table('group_invites').put({ ...inv, status: 'declined' });
      return {};
    }
    await requireHandle(c);
    const g = await c.tx.table('groups').get(inv.groupId);
    if (!g) throw new ApiError('not_found');
    await join(c, await settleDueWeeks(c, g));
    return {};
  },

  async group_join(c, args) {
    await requireHandle(c);
    const [g] = await c.tx.table('groups').find({ inviteCode: args.code.trim().toUpperCase() });
    if (!g || !g.inviteCodeEnabled) throw new ApiError('not_found');
    const group = await settleDueWeeks(c, g);
    await join(c, group);
    return { group: await groupView(c.tx, group, c.userId, c.now) };
  },

  async group_code(c, args) {
    const g = await ownGroup(c);
    let next = { ...g, inviteCodeEnabled: args.action !== 'disable' };
    if (args.action === 'regenerate') {
      for (let i = 0; ; i++) {
        const code = newInviteCode(c.env.random);
        if (!(await c.tx.table('groups').find({ inviteCode: code })).length || i > 20) {
          next = { ...next, inviteCode: code, inviteCodeEnabled: true };
          break;
        }
      }
    }
    try {
      await c.tx.table('groups').put(next);
    } catch (e) {
      if (e instanceof DuplicateKeyError) throw new ApiError('server_error');
      throw e;
    }
    return { code: next.inviteCode, enabled: next.inviteCodeEnabled };
  },

  /** Any member may leave; an owner transfers first unless they are the last member (that disbands). */
  async group_leave(c) {
    const g = await myGroup(c);
    const members = await membersOf(c.tx, g.id);
    if (g.ownerId === c.userId) {
      if (members.length > 1) throw new ApiError('invalid'); // transfer ownership first
      await disband(c, g);
      return {};
    }
    await removeMember(c, g, c.userId, 'leave');
    return {};
  },

  async group_remove_member(c, args) {
    const g = await ownGroup(c);
    if (args.userId === c.userId || (await membership(c.tx, args.userId))?.groupId !== g.id) throw new ApiError('not_found');
    await removeMember(c, g, args.userId, 'removed');
    return {};
  },

  async group_transfer(c, args) {
    const g = await ownGroup(c);
    const target = await membership(c.tx, args.userId);
    if (!target || target.groupId !== g.id || args.userId === c.userId) throw new ApiError('not_found');
    await c.tx.table('groups').put({ ...g, ownerId: args.userId });
    await c.tx.table('group_members').put({ ...target, role: 'owner' });
    const me = await membership(c.tx, c.userId);
    if (me) await c.tx.table('group_members').put({ ...me, role: 'member' });
    return {};
  },

  async group_set_war(c, args) {
    const g = await ownGroup(c);
    await c.tx.table('groups').put({ ...g, warEnabled: args.enabled });
    return {};
  },

  async group_disband(c) {
    await disband(c, await ownGroup(c));
    return {};
  },
};
