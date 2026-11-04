import { describe, expect, it } from 'vitest';
import { baselinePack } from '../domain/content/baseline';
import { content } from '../domain/content';
import { sha256Hex, verifyPack } from '../domain/content/remote';
import { seededRng } from '../domain/random';
import { createFakeRemote } from '../platform/remote/fake';
import { createMemoryStorage } from '../platform/storage/memory';
import { createAppStore } from './appStore';

/** A newer pack with one new island theme. */
async function newerPack(version: string) {
  const base = baselinePack.items.find((i) => i.id === 'snow')!;
  const pack = { ...baselinePack, atlas: undefined, contentVersion: version, items: [...baselinePack.items, { ...base, id: `lava-${version.replace(/\W/g, '')}`, name: { en: 'Lava', ko: '용암' } }] };
  const text = JSON.stringify(pack);
  return { text, checksum: await sha256Hex(text), themeId: `lava-${version.replace(/\W/g, '')}` };
}

describe('remote content packs (Step 5.8)', () => {
  it('verifies the checksum and the content before keeping a pack', async () => {
    const { text, checksum } = await newerPack('9999-01-01.1');
    expect(await verifyPack(text, '00')).toBe('checksum');
    const broken = JSON.stringify({ contentVersion: 'x', items: [{ kind: 'building', id: 'Bad Id' }], models: {} });
    expect(await verifyPack(broken, await sha256Hex(broken))).toBe('invalid');
    const ok = await verifyPack(text, checksum);
    expect(typeof ok === 'object' && ok.contentVersion).toBe('9999-01-01.1');
  });

  it('downloads a newer pack in the background and uses it from the next return to Home', async () => {
    const version = '9999-01-02.1';
    const { text, checksum, themeId } = await newerPack(version);
    const fake = createFakeRemote({ appVersion: '0.2.0' });
    await fake.db.transaction((tx) => tx.table('content_releases').put({ contentVersion: version, minClientVersion: '0.0.0', packUrl: 'https://cdn/pack.json', atlasUrl: 'https://cdn/atlas.png', checksum, publishedAt: 1 }));
    const storage = createMemoryStorage();
    let n = 0;
    const store = createAppStore({ storage, now: () => 1, rng: seededRng(1), uuid: () => `c-${++n}`, remote: fake, remoteContent: true, clientVersion: '0.2.0', fetchText: async () => text, fetchDataUrl: async () => '' });
    await store.getState().init();
    await store.getState().checkContent();
    // On Home already: used at once; kept for the next start.
    expect(content.get(themeId)).toBeDefined();
    expect(store.getState().contentVersion).toBe(version);
    expect((await storage.load()).contentPacks.map((p) => p.contentVersion)).toEqual([version]);
  });

  it('ignores a pack that is not newer, and a broken download', async () => {
    const fake = createFakeRemote({ appVersion: '0.2.0' });
    await fake.db.transaction((tx) => tx.table('content_releases').put({ contentVersion: '0.0.1', minClientVersion: '0.0.0', packUrl: 'u', atlasUrl: 'a', checksum: 'x', publishedAt: 1 }));
    const storage = createMemoryStorage();
    const store = createAppStore({ storage, now: () => 1, rng: seededRng(1), uuid: () => 'x', remote: fake, remoteContent: true, clientVersion: '0.2.0', fetchText: async () => 'not json', fetchDataUrl: async () => '' });
    await store.getState().init();
    await store.getState().checkContent();
    expect((await storage.load()).contentPacks).toEqual([]);
  });
});
