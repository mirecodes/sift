import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentPack } from '../../shared/content/pack';
import type { ContentReleaseRow } from '../../server/core/schema';
import { APP_VERSION } from '../../src/app/version';
import { baselinePack } from '../../src/domain/content/baseline';
import { sha256Hex } from '../../src/domain/content/remote';

/** Storage bucket the packs live in (public read). */
export const BUCKET = 'content';

/**
 * What a release uploads (Step 5.8): the pack JSON (without the atlas picture, which is its own file),
 * its checksum, and the `content_releases` row clients find through `get_content_manifest`.
 */
export async function releaseFiles(pack: ContentPack, opts: { publicBase: string; minClientVersion: string; now: number }) {
  const { atlas, ...rest } = pack;
  const body: ContentPack = atlas ? { ...rest, atlas: { size: atlas.size, width: atlas.width, height: atlas.height, frames: atlas.frames, image: '' } } : rest;
  const packText = JSON.stringify(body);
  const checksum = await sha256Hex(packText);
  const dir = `${pack.contentVersion}`;
  const row: ContentReleaseRow = {
    contentVersion: pack.contentVersion,
    minClientVersion: opts.minClientVersion,
    packUrl: `${opts.publicBase}/${dir}/pack.json`,
    atlasUrl: `${opts.publicBase}/${dir}/atlas.png`,
    checksum,
    publishedAt: opts.now,
  };
  return { packText, checksum, packPath: `${dir}/pack.json`, atlasPath: `${dir}/atlas.png`, row };
}

async function upload(url: string, key: string, path: string, body: string | Blob, type: string) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': type, 'x-upsert': 'true' },
    body,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
}

/**
 * `npm run content:publish -- [--dry-run] [--min-client x.y.z]`: uploads the current pack and atlas to
 * Supabase Storage and records the release (docs/guides/CONTENT.md §7, docs/guides/BACKEND_SETUP.md).
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never commit the service key).
 * `--dry-run` writes the files to dist-content/ instead.
 */
export async function main(args: string[]): Promise<number> {
  const dry = args.includes('--dry-run');
  const minIndex = args.indexOf('--min-client');
  const minClientVersion = minIndex >= 0 ? args[minIndex + 1]! : APP_VERSION;
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!dry && (!url || !key)) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).');
    return 1;
  }
  const out = await releaseFiles(baselinePack, { publicBase: `${url || 'https://example.supabase.co'}/storage/v1/object/public/${BUCKET}`, minClientVersion, now: Date.now() });
  const atlas = readFileSync('content/sprites/atlas.png');
  if (dry) {
    const dir = join('dist-content', out.row.contentVersion);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'pack.json'), out.packText);
    writeFileSync(join(dir, 'atlas.png'), atlas);
    writeFileSync(join(dir, 'release.json'), `${JSON.stringify(out.row, null, 2)}\n`);
    console.log(`dry run: ${dir} (checksum ${out.checksum})`);
    return 0;
  }
  await upload(url, key, out.packPath, out.packText, 'application/json');
  await upload(url, key, out.atlasPath, new Blob([new Uint8Array(atlas)]), 'image/png');
  const res = await fetch(`${url}/rest/v1/content_releases`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ content_version: out.row.contentVersion, data: out.row }),
  });
  if (!res.ok) throw new Error(`release row: ${res.status} ${await res.text()}`);
  console.log(`published ${out.row.contentVersion} for clients ≥ ${minClientVersion}`);
  return 0;
}
