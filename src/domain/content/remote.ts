import { compareVersions, type ContentPack, type PackItem } from '../../../shared/content/pack';
import { ContentFile } from '../../../shared/content/schema';

/** SHA-256 of a text as lowercase hex (the platform's WebCrypto; Node and browsers have it). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A downloaded pack (Step 5.8), checked before it is kept: the checksum matches the manifest, every item
 * passes the content schema, every model an item names is in the pack. Returns the pack, or why not.
 */
export async function verifyPack(text: string, checksum: string): Promise<ContentPack | 'checksum' | 'invalid'> {
  if ((await sha256Hex(text)) !== checksum) return 'checksum';
  let raw: { contentVersion?: unknown; items?: unknown; models?: unknown; atlas?: unknown };
  try {
    raw = JSON.parse(text);
  } catch {
    return 'invalid';
  }
  if (typeof raw.contentVersion !== 'string' || !Array.isArray(raw.items) || typeof raw.models !== 'object' || raw.models === null) return 'invalid';
  const models = raw.models as ContentPack['models'];
  const items: PackItem[] = [];
  for (const item of raw.items) {
    const parsed = ContentFile.safeParse(item);
    if (!parsed.success || parsed.data.kind === 'skinFamily') return 'invalid';
    const ref = 'model' in parsed.data ? parsed.data.model : 'overlay' in parsed.data ? parsed.data.overlay : undefined;
    if (ref && !models[ref]) return 'invalid';
    items.push(parsed.data as PackItem);
  }
  return { contentVersion: raw.contentVersion, items, models, ...(raw.atlas ? { atlas: raw.atlas as ContentPack['atlas'] } : {}) };
}

/** Is a manifest's pack newer than what the app has? */
export const isNewer = (contentVersion: string, current: string): boolean => compareVersions(contentVersion, current) > 0;
