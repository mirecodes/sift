import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import { createFakeRemote, FAKE_CODE } from '../platform/remote/fake';
import { createMemoryStorage } from '../platform/storage/memory';
import type { StorageAdapter } from '../platform/storage';
import { BuyError, createAppStore } from './appStore';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function world() {
  const clock = { t: Date.UTC(2026, 9, 27, 9) };
  let s = 0;
  const fake = createFakeRemote({ appVersion: '0.2.0', now: () => clock.t, random: seededRng(11), uuid: () => `srv-${++s}` });
  let c = 0;
  const device = (storage: StorageAdapter = createMemoryStorage(), seed = 1) =>
    createAppStore({ storage, now: () => clock.t, rng: seededRng(seed), uuid: () => `dev${seed}-${++c}`, remote: fake, economy: true, clientVersion: '0.2.0' });
  return { clock, fake, device };
}

/** Waits for background work (the server confirming a start) until `ok` holds, at most a second. */
async function until(ok: () => boolean) {
  for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
}

type Store = ReturnType<ReturnType<typeof world>['device']>;

/** Starts a focus and, signed in and online, waits until the server has confirmed it. */
async function start(store: Store) {
  await store.getState().startFocus();
  if (store.getState().account.status === 'signedIn' && store.getState().account.online) await until(() => store.getState().sessions.at(-1)?.verified === true);
}

/** Runs a full focus of `minutes` and ends it (End focus after the plan). */
async function focus(store: Store, clock: { t: number }, minutes = 30) {
  await start(store);
  clock.t += minutes * MIN;
  await store.getState().endFocus();
}

const signIn = async (store: Store, email = 'mina@example.com') => {
  await store.getState().requestSignInCode(email);
  await store.getState().verifySignInCode(email, FAKE_CODE);
};

describe('accounts and sync (Phase 5)', () => {
  it('first sign-in uploads the device save into an empty account and keeps playing from the server', async () => {
    const { clock, fake, device } = world();
    const a = device();
    await a.getState().init();
    expect(a.getState().account.status).toBe('signedOut');
    await focus(a, clock); // a local reward, before signing in
    await a.getState().goHome();
    const localAnimals = a.getState().animals.map((x) => x.id);
    await signIn(a);
    const s = a.getState();
    expect(s.account).toMatchObject({ status: 'signedIn', email: 'mina@example.com', choice: null });
    expect(s.animals.map((x) => x.id)).toEqual(localAnimals);
    expect(s.animals.every((x) => x.verified)).toBe(true);
    expect(s.gold).toBe(30); // the local starter gold carried over
    const server = await fake.send({ op: 'sync_pull', args: {}, sinceSeq: 0 });
    expect(server.ok && server.delta!.rows.animals.map((x) => x.id)).toEqual(localAnimals);
  });

  it('a signed-in focus is verified by the server, which rolls and places the reward', async () => {
    const { clock, device } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    await start(a);
    expect(a.getState().sessions.at(-1)).toMatchObject({ verified: true, status: 'running' });
    clock.t += 40 * MIN;
    await a.getState().endFocus();
    const s = a.getState();
    expect(s.phase).toMatchObject({ kind: 'break' });
    const rewardId = s.phase.kind === 'break' ? s.phase.rewardId : undefined;
    expect(rewardId).toBeDefined();
    expect(s.animals.find((x) => x.id === rewardId)).toMatchObject({ verified: true, status: 'active' });
    expect(s.revealPending).toBe(rewardId);
  });

  it('offline at the end: the break waits for the reward and reveals it when the server answers', async () => {
    const { clock, fake, device } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    await start(a);
    clock.t += 30 * MIN;
    fake.setOnline(false);
    await a.getState().endFocus();
    const waiting = a.getState().phase;
    expect(waiting.kind === 'break' && waiting.awaiting).toBeTruthy();
    expect(a.getState().account.online).toBe(false);
    fake.setOnline(true);
    await a.getState().sync(true);
    const s = a.getState();
    expect(s.phase.kind === 'break' && !s.phase.awaiting && s.phase.rewardId).toBeTruthy();
    expect(s.revealPending).toBe(s.phase.kind === 'break' ? s.phase.rewardId : null);
    expect(s.account.online).toBe(true);
  });

  it('offline at the start: rewarded locally, unverified, and uploaded later', async () => {
    const { clock, fake, device } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    fake.setOnline(false);
    await focus(a, clock);
    const reward = a.getState().animals.at(-1)!;
    expect(reward).toMatchObject({ verified: false, status: 'active' });
    fake.setOnline(true);
    await a.getState().goHome();
    const server = await fake.send({ op: 'sync_pull', args: {}, sinceSeq: 0 });
    expect(server.ok && server.delta!.rows.animals.find((x) => x.id === reward.id)).toMatchObject({ verified: false });
  });

  it('buys through the server, and needs a connection to do so', async () => {
    const { device, fake } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    await a.getState().sync(true);
    await a.getState().buyItem('fence');
    expect(a.getState().gold).toBe(20);
    expect(a.getState().cosmetics.map((c) => c.defId)).toEqual(['fence']);
    fake.setOnline(false);
    await expect(a.getState().buyItem('fence')).rejects.toEqual(new BuyError('offline'));
    expect(a.getState().gold).toBe(20);
  });

  it('a second device with its own data asks; "use the account" replaces the device data', async () => {
    const { clock, device } = world();
    const a = device(createMemoryStorage(), 1);
    await a.getState().init();
    await signIn(a);
    await focus(a, clock);
    await a.getState().goHome();
    const accountAnimals = a.getState().animals.map((x) => x.id);

    const b = device(createMemoryStorage(), 2);
    await b.getState().init();
    await focus(b, clock);
    await b.getState().goHome();
    await signIn(b);
    expect(b.getState().account.choice).toMatchObject({ email: 'mina@example.com' });
    await b.getState().resolveAccountChoice('useAccount');
    expect(b.getState().account.status).toBe('signedIn');
    expect(b.getState().animals.map((x) => x.id)).toEqual(accountAnimals);
    expect(b.getState().world.seed).toBe(a.getState().world.seed);
  });

  it('"replace the account" uploads this device instead', async () => {
    const { clock, device, fake } = world();
    const a = device(createMemoryStorage(), 1);
    await a.getState().init();
    await signIn(a);
    const b = device(createMemoryStorage(), 2);
    await b.getState().init();
    await focus(b, clock);
    await b.getState().goHome();
    const mine = b.getState().animals.map((x) => x.id);
    await signIn(b);
    await b.getState().resolveAccountChoice('replaceAccount');
    const server = await fake.send({ op: 'sync_pull', args: {}, sinceSeq: 0 });
    expect(server.ok && server.delta!.rows.animals.map((x) => x.id)).toEqual(mine);
  });

  it('signing out starts the device over; settings stay', async () => {
    const { clock, device } = world();
    const a = device();
    await a.getState().init();
    await a.getState().updateSettings({ focusMinutes: 40 });
    await signIn(a);
    await focus(a, clock, 45);
    await a.getState().goHome();
    const seed = a.getState().world.seed;
    await a.getState().signOut();
    const s = a.getState();
    expect(s.account.status).toBe('signedOut');
    expect(s.animals).toEqual([]);
    expect(s.world.seed).not.toBe(seed);
    expect(s.settings.focusMinutes).toBe(40);
    expect(s.gold).toBe(30); // a fresh local save gets its starter gold
  });

  it('expirations come from the server: departures, gold and the notice', async () => {
    const { clock, device } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    await focus(a, clock);
    await a.getState().goHome();
    const animal = a.getState().animals.at(-1)!;
    const gold = a.getState().gold;
    clock.t += 8 * DAY;
    await a.getState().sync(true);
    const s = a.getState();
    if (animal.speciesId === 'unicorn') return; // a rare roll never leaves
    expect(s.animals.find((x) => x.id === animal.id)?.status).toBe('departed');
    expect(s.gold).toBeGreaterThan(gold);
    expect(s.inbox.map((n) => n.notice.kind)).toContain('animals_departed');
  });

  it('equip changes and dismissed notices reach the server through the outbox', async () => {
    const { device, fake } = world();
    const a = device();
    await a.getState().init();
    await signIn(a);
    await a.getState().sync(true);
    await a.getState().equipTheme('default');
    await new Promise((r) => setTimeout(r, 0));
    const server = await fake.send({ op: 'sync_pull', args: {}, sinceSeq: 0 });
    expect(server.ok && server.delta!.rows.equipped).toEqual({ skinsBySpecies: {}, blockThemeId: 'default' });
  });
});
