import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import { createFakeRemote, FAKE_CODE } from '../platform/remote/fake';
import { MemoryServerDb } from '../../server/core/db';
import { createMemoryStorage } from '../platform/storage/memory';
import { createAppStore } from './appStore';

const MIN = 60_000;

/** Two devices of two people on one fake server; each device has its own sign-in. */
function world() {
  const clock = { t: Date.UTC(2026, 9, 27, 9) };
  let s = 0;
  let c = 0;
  const db = new MemoryServerDb();
  const device = () => {
    const fake = createFakeRemote({ appVersion: '0.2.0', now: () => clock.t, random: seededRng(5), uuid: () => `srv-${++s}`, db });
    return createAppStore({ storage: createMemoryStorage(), now: () => clock.t, rng: seededRng(1), uuid: () => `d-${++c}`, remote: fake, economy: true, clientVersion: '0.2.0' });
  };
  return { clock, a: device(), b: device() };
}

async function signIn(store: ReturnType<typeof createAppStore>, email: string, name: string) {
  await store.getState().init();
  await store.getState().requestSignInCode(email);
  await store.getState().verifySignInCode(email, FAKE_CODE);
  expect(await store.getState().setHandle(name)).toBeNull();
  return store.getState().social!.me.handle!;
}

describe('friends, visits and focus together in the store (Phase 7)', () => {
  it('adds a friend by handle, shows them focusing, and visits their island', async () => {
    const { a, b } = world();
    const ha = await signIn(a, 'mina@example.com', '민지');
    const hb = await signIn(b, 'jae@example.com', 'Jae');
    expect((await a.getState().addFriend('nobody#0001')).outcome).toBe('not_found');
    expect((await a.getState().addFriend('not a handle')).outcome).toBe('handle_invalid');
    expect(await a.getState().addFriend(`${hb.name}#${hb.tag}`)).toEqual({ outcome: null, status: 'pending' });
    await b.getState().refreshSocial();
    expect(b.getState().social!.incoming.map((p) => p.handle)).toEqual([ha]);
    expect(await b.getState().respondFriend(a.getState().account.userId!, true)).toBeNull();
    await a.getState().refreshSocial();
    expect(a.getState().social!.friends.map((p) => p.handle?.name)).toEqual(['Jae']);

    await b.getState().startFocus();
    for (let i = 0; i < 50 && !b.getState().sessions.at(-1)?.verified; i++) await new Promise((r) => setTimeout(r, 5));
    await a.getState().refreshSocial();
    expect(a.getState().social!.friends[0]!.focusing).toBe(true);

    expect(await a.getState().visitIsland(b.getState().account.userId!)).toBeNull();
    expect(a.getState().visit).toMatchObject({ handle: { name: 'Jae' } });
    a.getState().leaveVisit();
    expect(a.getState().visit).toBeNull();
  });

  it('starts everyone in a room at the same server time', async () => {
    const { clock, a, b } = world();
    await signIn(a, 'mina@example.com', 'Mina');
    const hb = await signIn(b, 'jae@example.com', 'Jae');
    await a.getState().addFriend(`${hb.name}#${hb.tag}`);
    await b.getState().respondFriend(a.getState().account.userId!, true);
    expect(await a.getState().createRoom([b.getState().account.userId!])).toBeNull();
    const roomId = a.getState().room!.id;
    expect(await b.getState().joinRoom(roomId)).toBeNull();
    clock.t += 30_000;
    expect(await a.getState().startRoom()).toBeNull();
    clock.t += 3_000;
    await b.getState().pollRoom();
    const pa = a.getState().phase;
    const pb = b.getState().phase;
    expect(pa.kind).toBe('focus');
    expect(pb.kind).toBe('focus');
    if (pa.kind === 'focus' && pb.kind === 'focus') {
      expect(pb.startedAt).toBe(pa.startedAt);
      expect(pb.plannedMs).toBe(a.getState().settings.focusMinutes * MIN);
    }
    expect(b.getState().sessions.at(-1)).toMatchObject({ togetherRoomId: roomId, verified: true });
  });
});
