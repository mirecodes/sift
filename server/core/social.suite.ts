import { describe, expect, it } from 'vitest';
import type { ErrorCode, Op, OpArgs } from '../../shared/api/types';
import type { PushMessage } from './context';
import type { ServerDb } from './db';
import { MIN, testServer } from './testing';

const DAY = 24 * 60 * MIN;

/**
 * Phase 7 (identity, friends, moderation, visits, presence, focus together), run against every server
 * database adapter like the core contract: memory in `api.test.ts`, Postgres (PGlite) in `pg.test.ts`.
 */
export function describeSocial(name: string, makeDb: () => Promise<ServerDb> | ServerDb) {
  async function world() {
    const s = testServer({ db: await makeDb() });
    const pushes: [string, PushMessage][] = [];
    s.env.hooks = { push: async (userId, message) => void pushes.push([userId, message]) };
    /** Signs up a user with a name and returns their tag. */
    const named = async (userId: string, nameText: string) => (await s.ok(userId, 'set_handle', { name: nameText })).profile.handle!;
    const fails = async <O extends Op>(userId: string, op: O, args: OpArgs<O>): Promise<ErrorCode | null> => {
      const r = await s.call(userId, op, args);
      return r.ok ? null : r.error.code;
    };
    /** Two friends, `a` (민지) and `b` (Jae). */
    const friends = async () => {
      const ha = await named('a', '민지');
      const hb = await named('b', 'Jae');
      await s.ok('a', 'friend_request', hb);
      await s.ok('b', 'friend_request', ha); // the request waiting the other way is accepted
      return { ha, hb };
    };
    return { ...s, pushes, named, fails, friends };
  }

  describe(`social (${name})`, () => {
    it('assigns a tag, keeps it on a name change when free, and enforces the cooldown', async () => {
      const s = await world();
      const first = await s.named('a', 'Mina');
      expect(first.name).toBe('Mina');
      expect(first.tag).toMatch(/^\d{4}$/);
      // Same key, other case: the tag stays (no one else has Mina#tag).
      const fixed = await s.named('a', 'mina');
      expect(fixed.tag).toBe(first.tag);
      // The first change was free; the next waits 30 days.
      expect(await s.fails('a', 'set_handle', { name: 'Minji' })).toBe('name_change_cooldown');
      s.clock.t += 31 * DAY;
      expect((await s.named('a', 'Minji')).tag).toBe(first.tag);
    });

    it('rejects invalid and filtered names, and never gives two people the same name#tag', async () => {
      const s = await world();
      for (const bad of ['ㄱㄴ', 'admin', '1234', 'a', 'shit2', '씨발이', 'Mina😀']) expect(await s.fails('a', 'set_handle', { name: bad })).toBe('handle_invalid');
      const tags = new Set<string>();
      for (let i = 0; i < 30; i++) tags.add((await s.named(`u${i}`, 'Same')).tag);
      expect(tags.size).toBe(30);
    });

    it('needs a name before friends; adds by exact handle only; a crossing request is accepted', async () => {
      const s = await world();
      expect(await s.fails('a', 'friend_request', { name: 'Jae', tag: '0001' })).toBe('handle_required');
      const ha = await s.named('a', '민지');
      const hb = await s.named('b', 'Jae');
      expect(await s.fails('a', 'friend_request', { name: 'Ja', tag: hb.tag })).toBe('not_found');
      expect((await s.ok('a', 'friend_request', hb)).status).toBe('pending');
      expect((await s.ok('a', 'friend_request', hb)).status).toBe('pending'); // a repeat changes nothing
      const b = await s.ok('b', 'social_state', {});
      expect(b.incoming.map((p) => p.handle)).toEqual([ha]);
      expect(s.pushes.map(([u, m]) => [u, m.category])).toEqual([['b', 'friends']]);
      expect((await s.ok('b', 'friend_request', ha)).status).toBe('accepted');
      expect((await s.ok('a', 'social_state', {})).friends.map((p) => p.userId)).toEqual(['b']);
      expect((await s.ok('b', 'social_state', {})).incoming).toEqual([]);
    });

    it('accepts, declines, cancels and removes', async () => {
      const s = await world();
      await s.named('a', 'Ana');
      const hb = await s.named('b', 'Bo');
      const hc = await s.named('c', 'Cy');
      await s.ok('a', 'friend_request', hb);
      await s.ok('a', 'friend_request', hc);
      await s.ok('b', 'friend_respond', { userId: 'a', accept: true });
      await s.ok('c', 'friend_respond', { userId: 'a', accept: false });
      expect((await s.ok('a', 'social_state', {})).friends.map((p) => p.userId)).toEqual(['b']);
      expect((await s.ok('a', 'social_state', {})).outgoing).toEqual([]);
      await s.ok('a', 'friend_request', hc);
      await s.ok('a', 'friend_cancel', { userId: 'c' });
      expect((await s.ok('c', 'social_state', {})).incoming).toEqual([]);
      await s.ok('b', 'friend_remove', { userId: 'a' });
      expect((await s.ok('a', 'social_state', {})).friends).toEqual([]);
    });

    it('blocking removes the friendship and hides everything both ways', async () => {
      const s = await world();
      const { ha, hb } = await s.friends();
      await s.ok('a', 'block_user', { userId: 'b' });
      expect((await s.ok('a', 'social_state', {})).friends).toEqual([]);
      expect((await s.ok('a', 'social_state', {})).blocked.map((p) => p.userId)).toEqual(['b']);
      expect(await s.fails('b', 'friend_request', ha)).toBe('not_found');
      expect(await s.fails('a', 'friend_request', hb)).toBe('not_found');
      expect(await s.fails('b', 'get_island_snapshot', { userId: 'a' })).toBe('blocked');
      await s.ok('a', 'unblock_user', { userId: 'b' });
      expect((await s.ok('a', 'friend_request', hb)).status).toBe('pending');
    });

    it('stores reports', async () => {
      const s = await world();
      await s.named('a', 'Ana');
      await s.named('b', 'Bo');
      await s.ok('a', 'report_user', { userId: 'b', reason: 'name', note: 'rude', context: 'friends' });
      const rows = await s.env.db.transaction((tx) => tx.table('reports').find({ reportedId: 'b' }));
      expect(rows).toMatchObject([{ reporterId: 'a', reason: 'name', note: 'rude', context: 'friends' }]);
      expect(await s.fails('a', 'report_user', { userId: 'nobody', reason: 'other', context: 'visit' })).toBe('not_found');
    });

    it('shows a friend’s island, records one visit per day, and refuses strangers', async () => {
      const s = await world();
      await s.friends();
      const { session } = await s.ok('b', 'start_session', { plannedMs: 25 * MIN }, { requestId: 'sb' });
      s.clock.t += 26 * MIN;
      await s.ok('b', 'end_session', { sessionId: session.id, endedAt: s.clock.t, status: 'completed' });
      const { snapshot } = await s.ok('a', 'get_island_snapshot', { userId: 'b' });
      // 30 starter gold: pile level 3 (thresholds 1, 10, 30, …).
      expect(snapshot).toMatchObject({ userId: 'b', handle: { name: 'Jae' }, level: 1, goldPileLevel: 3 });
      expect(snapshot.animals).toHaveLength(1);
      await s.ok('a', 'get_island_snapshot', { userId: 'b' });
      const host = await s.ok('b', 'social_state', {});
      expect(host.visitCount).toBe(1);
      expect(host.visitors.map((v) => v.person.userId)).toEqual(['a']);
      s.clock.t += DAY;
      await s.ok('a', 'get_island_snapshot', { userId: 'b' });
      expect((await s.ok('b', 'social_state', {})).visitCount).toBe(2);
      await s.named('c', 'Cy');
      expect(await s.fails('c', 'get_island_snapshot', { userId: 'b' })).toBe('not_friends');
      // Visits older than the retention window are gone.
      s.clock.t += 31 * DAY;
      expect((await s.ok('b', 'social_state', {})).visitCount).toBe(0);
    });

    it('shows "focusing now" to friends only while they share it, and pushes nothing to a focusing user', async () => {
      const s = await world();
      const { hb } = await s.friends();
      await s.ok('b', 'start_session', { plannedMs: 25 * MIN }, { requestId: 'sb' });
      expect((await s.ok('a', 'social_state', {})).friends[0]!.focusing).toBe(true);
      await s.ok('b', 'sync_push', { ops: [{ kind: 'presence_setting', showPresence: false }] });
      expect((await s.ok('a', 'social_state', {})).friends[0]!.focusing).toBe(false);
      // A request to a focusing user waits in the Inbox, no push.
      const before = s.pushes.length;
      await s.named('c', 'Cy');
      await s.ok('c', 'friend_request', hb);
      expect(s.pushes.length).toBe(before);
      expect((await s.ok('b', 'social_state', {})).incoming).toHaveLength(1);
    });

    it('focus together: shared start, late join with the remaining time, closed after the window', async () => {
      const s = await world();
      await s.friends();
      await s.named('c', 'Cy');
      await s.ok('a', 'friend_request', (await s.ok('c', 'social_state', {})).me.handle!);
      await s.ok('c', 'friend_respond', { userId: 'a', accept: true });
      const { room } = await s.ok('a', 'together_create', { plannedMs: 30 * MIN, invitees: ['b', 'c'] });
      expect(room.participants.map((p) => [p.person.userId, p.state])).toEqual([
        ['a', 'joined'],
        ['b', 'invited'],
        ['c', 'invited'],
      ]);
      expect(s.pushes.filter(([, m]) => m.category === 'together').map(([u]) => u)).toEqual(['b', 'c']);
      await s.ok('b', 'together_join', { roomId: room.id });
      expect(await s.fails('b', 'together_start', { roomId: room.id })).toBe('not_owner');
      const startAt = s.clock.t + MIN;
      s.clock.t = startAt;
      await s.ok('a', 'together_start', { roomId: room.id });
      s.clock.t += 5_000;
      const a = await s.ok('a', 'start_session', { plannedMs: 30 * MIN, roomId: room.id }, { requestId: 'sa' });
      const b = await s.ok('b', 'start_session', { plannedMs: 30 * MIN, roomId: room.id }, { requestId: 'sb' });
      expect(a.session.startedAt).toBe(startAt);
      expect(b.session.startedAt).toBe(startAt);
      // Late within 2 minutes: own start, the room's end.
      s.clock.t = startAt + 90_000;
      await s.ok('c', 'together_join', { roomId: room.id });
      const c = await s.ok('c', 'start_session', { plannedMs: 30 * MIN, roomId: room.id }, { requestId: 'sc' });
      expect(c.session.startedAt).toBe(startAt + 90_000);
      expect(c.session.startedAt + c.session.plannedFocusMs).toBe(startAt + 30 * MIN);
      const view = (await s.ok('a', 'together_room', { roomId: room.id })).room;
      expect(view.participants.map((p) => p.state)).toEqual(['focusing', 'focusing', 'focusing']);
      // Rewards stay individual: b stops, a completes.
      await s.ok('b', 'end_session', { sessionId: b.session.id, endedAt: s.clock.t, status: 'abandoned' });
      s.clock.t = startAt + 31 * MIN;
      const done = await s.ok('a', 'end_session', { sessionId: a.session.id, endedAt: s.clock.t, status: 'completed' });
      const after = (await s.ok('c', 'together_room', { roomId: room.id })).room;
      expect(after.participants.map((p) => p.state)).toEqual(['done', 'stopped', 'focusing']);
      expect(after.participants[0]!.animal?.speciesId).toBe(done.animal?.speciesId);
      expect(await s.fails('c', 'together_join', { roomId: room.id })).toBe('room_closed');
    });

    it('focus together: lobbies expire, the host leaving closes them, strangers cannot be invited', async () => {
      const s = await world();
      await s.friends();
      await s.named('c', 'Cy');
      expect(await s.fails('a', 'together_create', { plannedMs: 25 * MIN, invitees: ['c'] })).toBe('not_friends');
      const { room } = await s.ok('a', 'together_create', { plannedMs: 25 * MIN, invitees: ['b'] });
      s.clock.t += 6 * MIN;
      expect((await s.ok('b', 'together_room', { roomId: room.id })).room.status).toBe('closed');
      expect(await s.fails('b', 'together_join', { roomId: room.id })).toBe('room_closed');
      const second = (await s.ok('a', 'together_create', { plannedMs: 25 * MIN, invitees: ['b'] })).room;
      await s.ok('b', 'together_join', { roomId: second.id });
      await s.ok('b', 'together_leave', { roomId: second.id });
      expect((await s.ok('a', 'together_room', { roomId: second.id })).room.participants[1]!.state).toBe('left');
      expect((await s.ok('a', 'together_leave', { roomId: second.id })).room.status).toBe('closed');
      expect(await s.fails('c', 'together_room', { roomId: second.id })).toBe('not_found');
      expect(await s.fails('b', 'start_session', { plannedMs: 25 * MIN, roomId: second.id })).toBe('room_closed');
    });

    it('deleting an account removes it from other people’s lists', async () => {
      const s = await world();
      await s.friends();
      await s.ok('a', 'get_island_snapshot', { userId: 'b' });
      await s.ok('a', 'delete_account', {});
      const b = await s.ok('b', 'social_state', {});
      expect(b.friends).toEqual([]);
      expect(b.visitCount).toBe(0);
    });
  });
}
