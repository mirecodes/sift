import { describe, expect, it } from 'vitest';
import { seededRng } from '../../../shared/rng';
import { callApi } from './index';
import { createFakeRemote } from './fake';
import { seedFakeSocial } from './fakeBots';

describe('sample friends for the test backend (ADR-038)', () => {
  it('gives a new user three friends (one focusing), a request and a visitor, once', async () => {
    let n = 0;
    const fake = createFakeRemote({ appVersion: '0.2.0', random: seededRng(3), uuid: () => `u${++n}`, onSignIn: seedFakeSocial });
    await fake.signInAs('me');
    await fake.signInAs('me'); // a second sign-in adds nothing
    const { data } = await callApi(fake, 'social_state', {});
    expect(data.friends.map((p) => p.handle?.name).sort()).toEqual(['Jae', '민지', '소라'].sort());
    expect(data.friends.find((p) => p.handle?.name === '민지')?.focusing).toBe(true);
    expect(data.incoming.map((p) => p.handle?.name)).toEqual(['Leo']);
    expect(data.visitors.map((v) => v.person.handle?.name)).toEqual(['Jae']);
    const { data: island } = await callApi(fake, 'get_island_snapshot', { userId: 'bot-sora' });
    expect(island.snapshot.animals.length).toBe(6);
  });
});
