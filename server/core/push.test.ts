import { describe, expect, it } from 'vitest';
import type { PushMessage } from './context';
import { UserWriter } from './context';
import { planPushes, sendPushes } from './push';
import { testServer, MIN } from './testing';
import { ensureProfile, notify } from './user';

/** Writes notices for two users in one transaction and returns the planned pushes. */
async function plan(s: ReturnType<typeof testServer>, notices: { userId: string; kind: 'friend_request' | 'animals_departed' | 'war_report' }[]) {
  return s.env.db.transaction(async (tx) => {
    const writers = new Map<string, UserWriter>();
    for (const n of notices) {
      await ensureProfile(tx, n.userId, s.clock.t);
      const w = writers.get(n.userId) ?? new UserWriter(tx, n.userId);
      writers.set(n.userId, w);
      const notice =
        n.kind === 'friend_request'
          ? { kind: 'friend_request' as const, userId: 'x' }
          : n.kind === 'war_report'
            ? { kind: 'war_report' as const, warId: 'w1', role: 'defender' as const, result: 'loss' as const }
            : { kind: 'animals_departed' as const, animalIds: [], gold: 0 };
      await notify(w, s.env.uuid(), s.clock.t, notice);
    }
    for (const w of writers.values()) await w.finish();
    return planPushes(tx, s.clock.t, writers.values());
  });
}

describe('push (Step 6.6)', () => {
  it('pushes social notices with their category; Inbox-only notices stay quiet', async () => {
    const s = testServer();
    const jobs = await plan(s, [
      { userId: 'a', kind: 'friend_request' },
      { userId: 'a', kind: 'animals_departed' },
      { userId: 'b', kind: 'war_report' },
    ]);
    expect(jobs.map((j) => [j.userId, j.message.category])).toEqual([
      ['a', 'friends'],
      ['b', 'war'],
    ]);
    expect(jobs[1]!.message.url).toBe('/war/w1');
  });

  it('suppresses pushes while the user focuses (the focus rule), and again once the session is stale', async () => {
    const s = testServer();
    await s.ok('a', 'start_session', { plannedMs: 25 * MIN }, { requestId: 'start' });
    expect(await plan(s, [{ userId: 'a', kind: 'friend_request' }])).toEqual([]);
    s.clock.t += 25 * MIN + 3 * 3_600_000; // the app was closed long ago: no longer focusing
    expect(await plan(s, [{ userId: 'a', kind: 'friend_request' }])).toHaveLength(1);
  });

  it('sends through the host and never fails the call when a push fails', async () => {
    const s = testServer();
    const sent: [string, PushMessage][] = [];
    s.env.hooks = {
      push: async (userId, message) => {
        if (userId === 'bad') throw new Error('fcm down');
        sent.push([userId, message]);
      },
    };
    const message: PushMessage = { category: 'friends', title: 't', body: 'b' };
    await sendPushes(s.env, [{ userId: 'bad', message }, { userId: 'ok', message }]);
    expect(sent).toEqual([['ok', message]]);
  });
});
