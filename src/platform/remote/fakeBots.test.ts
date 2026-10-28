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
    // Phase 8: an invite into 민지's group, which has a champion and mission progress.
    await callApi(fake, 'set_handle', { name: 'Mina' }, { requestId: 'r1' });
    const { data: groups } = await callApi(fake, 'group_state', {});
    expect(groups.invites.map((i) => i.groupName)).toEqual(['Morning Owls']);
    await callApi(fake, 'group_invite_respond', { inviteId: groups.invites[0]!.id, accept: true }, { requestId: 'r2' });
    const { data: mine } = await callApi(fake, 'group_state', {});
    expect(mine.group!.members).toHaveLength(5);
    expect(mine.group!.members.find((m) => m.champion)?.person.handle?.name).toBe('소라');
    expect(mine.group!.mission.progressMinutes).toBe(545);
  });
});
