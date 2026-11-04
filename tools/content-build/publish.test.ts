import { describe, expect, it } from 'vitest';
import { baselinePack } from '../../src/domain/content/baseline';
import { verifyPack } from '../../src/domain/content/remote';
import { releaseFiles } from './publish';

describe('content:publish (Step 5.8)', () => {
  it('builds a pack clients verify, and the release row that points at it', async () => {
    const out = await releaseFiles(baselinePack, { publicBase: 'https://x.supabase.co/storage/v1/object/public/content', minClientVersion: '0.2.0', now: 5 });
    expect(out.row).toEqual({
      contentVersion: baselinePack.contentVersion,
      minClientVersion: '0.2.0',
      packUrl: `https://x.supabase.co/storage/v1/object/public/content/${baselinePack.contentVersion}/pack.json`,
      atlasUrl: `https://x.supabase.co/storage/v1/object/public/content/${baselinePack.contentVersion}/atlas.png`,
      checksum: out.checksum,
      publishedAt: 5,
    });
    const pack = await verifyPack(out.packText, out.checksum);
    expect(typeof pack === 'object' && pack.items.length).toBe(baselinePack.items.length);
    expect(typeof pack === 'object' && pack.atlas?.image).toBe(''); // the picture is its own file
  });
});
