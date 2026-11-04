import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import type { PushAdapter } from '../platform/push';
import { createFakeRemote, FAKE_CODE } from '../platform/remote/fake';
import { createMemoryStorage } from '../platform/storage/memory';
import { createAppStore } from './appStore';

/** A phone: fake server, a push adapter that grants permission when asked. */
function phone(opts: { available?: boolean } = {}) {
  const clock = { t: Date.UTC(2026, 9, 27, 9) };
  let s = 0;
  const fake = createFakeRemote({ appVersion: '0.2.0', now: () => clock.t, random: seededRng(3), uuid: () => `srv-${++s}` });
  const asked: string[] = [];
  let granted = false;
  const push: PushAdapter = {
    available: opts.available ?? true,
    register: async () => {
      asked.push('register');
      granted = true;
      return 'token-1';
    },
    token: async () => (granted ? 'token-1' : null),
    onOpen: () => () => undefined,
  };
  let c = 0;
  const store = createAppStore({ storage: createMemoryStorage(), now: () => clock.t, rng: seededRng(1), uuid: () => `d-${++c}`, remote: fake, economy: true, clientVersion: '0.2.0', push, platformName: 'ios', locale: 'ko-KR' });
  const devices = () => fake.env.db.transaction((tx) => tx.table('devices').find({}));
  return { store, get: store.getState, fake, asked, devices };
}

const signIn = async (store: ReturnType<typeof phone>['store']) => {
  await store.getState().requestSignInCode('mina@example.com');
  await store.getState().verifySignInCode('mina@example.com', FAKE_CODE);
};

describe('push permission and devices (Step 6.6)', () => {
  it('never asks at launch or sign-in; the first social action shows the explanation once', async () => {
    const p = phone();
    await p.get().init();
    await signIn(p.store);
    expect(p.asked).toEqual([]);
    expect(await p.devices()).toEqual([]);
    p.get().askPush();
    expect(p.get().pushPrompt).toBe(true);
    await p.get().answerPush(true);
    expect(p.get().pushPrompt).toBe(false);
    expect(p.asked).toEqual(['register']);
    expect(await p.devices()).toMatchObject([{ platform: 'ios', pushToken: 'token-1', locale: 'ko-KR', categories: { friends: true, war: true } }]);
    p.get().askPush();
    expect(p.get().pushPrompt).toBe(false); // answered: never again
  });

  it('"Not now" is remembered; a category toggle later asks and registers with that choice', async () => {
    const p = phone();
    await p.get().init();
    await signIn(p.store);
    p.get().askPush();
    await p.get().answerPush(false);
    expect(p.asked).toEqual([]);
    await p.get().setPushCategory('war', false);
    expect(p.asked).toEqual(['register']);
    expect(await p.devices()).toMatchObject([{ categories: { war: false, friends: true } }]);
  });

  it('does nothing signed out or where push is not available (web)', async () => {
    const web = phone({ available: false });
    await web.get().init();
    await signIn(web.store);
    web.get().askPush();
    expect(web.get().pushPrompt).toBe(false);
    const out = phone();
    await out.get().init();
    out.get().askPush();
    expect(out.get().pushPrompt).toBe(false);
  });
});

describe('deep links (Step 6.5)', () => {
  it('keeps the link the app was opened with until the screen for its kind takes it', async () => {
    const p = phone();
    await p.get().init();
    p.get().openLink('https://sift.example.com/not-a-link');
    expect(p.get().pendingLink).toBeNull();
    p.get().openLink('https://sift.example.com/join/AB12CD34');
    expect(p.get().takeLink('add')).toBeNull();
    expect(p.get().takeLink('join')).toEqual({ kind: 'join', code: 'AB12CD34' });
    expect(p.get().pendingLink).toBeNull();
  });
});
