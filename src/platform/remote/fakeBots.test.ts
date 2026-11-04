import { describe, expect, it } from 'vitest';
import { seededRng } from '../../../shared/rng';
import { callApi } from './index';
import { createFakeRemote } from './fake';
import { seedFakeSocial, testTools } from './fakeBots';

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

  it('test tools: an army to attack with, timers that reset, and a bot that attacks back', async () => {
    let n = 0;
    const clock = { t: Date.UTC(2026, 10, 4, 12) }; // a Wednesday: far from the weekly settlement freeze
    const fake = createFakeRemote({ appVersion: '0.2.0', now: () => clock.t, random: seededRng(5), uuid: () => `u${++n}`, onSignIn: seedFakeSocial });
    await fake.signInAs('me');
    expect(await testTools.grantArmy(fake, 'me')).toBe('no_island');
    await callApi(fake, 'upload_local_save', { replace: false, save: { world: { seed: 7, blockThemeId: 'default' }, animals: [], sessions: [], ledger: [], cosmetics: [], placedBuildings: [], islandHistory: [] } }, { requestId: 'up' });
    expect(await testTools.botAttack(fake, 'me')).toBe('no_group');
    await callApi(fake, 'set_handle', { name: 'Mina' }, { requestId: 'h' });
    const { data: groups } = await callApi(fake, 'group_state', {});
    await callApi(fake, 'group_invite_respond', { inviteId: groups.invites[0]!.id, accept: true }, { requestId: 'join' });

    expect((await callApi(fake, 'war_preview', { targetId: 'bot-jae' })).data.preview.blocked).toEqual({ code: 'no_army' });
    expect(await testTools.grantArmy(fake, 'me')).toBe('ok');
    const { data: preview } = await callApi(fake, 'war_preview', { targetId: 'bot-jae' });
    expect(preview.preview.blocked).toBeNull();
    expect(preview.preview.unicornsHome).toBe(1);
    await callApi(fake, 'declare_war', { targetId: 'bot-jae' }, { requestId: 'w1' });
    expect((await callApi(fake, 'war_preview', { targetId: 'bot-sora' })).data.preview.blocked?.code).toBe('cooldown_active');
    await testTools.resetWarTimers(fake, 'me');
    expect((await callApi(fake, 'war_preview', { targetId: 'bot-jae' })).data.preview.blocked).toBeNull();

    // A bot attacks the user, even right after the user joined (protection) and was attacked (shield).
    expect(await testTools.botAttack(fake, 'me')).toBe('ok');
    expect(await testTools.botAttack(fake, 'me')).toBe('ok');
    const { data: wars } = await callApi(fake, 'war_list', {});
    expect(wars.wars.filter((w) => w.role === 'defender')).toHaveLength(2);
  });
});
