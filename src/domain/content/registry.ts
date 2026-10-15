import { compareVersions, type ContentPack, type PackItem } from '../../../shared/content/pack';
import type { VoxelModel } from '../../../shared/content/model';
import type { ItemDef, ItemKind, ReleaseDef, SpeciesDef } from '../../../shared/content/schema';

type ByKind = { species: SpeciesDef; release: ReleaseDef } & { [K in ItemKind]: Extract<ItemDef, { kind: K }> };

/** Semver-ish `x.y.z` compare. */
const compareClient = (a: string, b: string) => compareVersions(a, b);

/** Is a purchasable item offered right now on this app version (availability window, `minClientVersion`)? */
export function isAvailable(item: ItemDef, now: number, clientVersion: string): boolean {
  if (item.availableFrom && now < Date.parse(item.availableFrom)) return false;
  if (item.availableUntil && now >= Date.parse(item.availableUntil)) return false;
  if (item.minClientVersion && compareClient(item.minClientVersion, clientVersion) > 0) return false;
  return true;
}

/**
 * All content the app knows (guidance_v2 §2.13). Starts from the bundled baseline pack and merges
 * newer packs: per item the pack with the newer `contentVersion` wins; items a newer pack drops stay
 * known (owned items keep rendering) but are marked retired and leave the shop.
 */
export class ContentRegistry {
  private items = new Map<string, { item: PackItem; version: string; retired: boolean }>();
  private models = new Map<string, VoxelModel>();
  private latest = '';

  constructor(baseline: ContentPack) {
    this.merge(baseline);
  }

  get contentVersion(): string {
    return this.latest;
  }

  merge(pack: ContentPack): void {
    const newest = compareVersions(pack.contentVersion, this.latest) >= 0;
    const ids = new Set(pack.items.map((i) => i.id));
    for (const item of pack.items) {
      const cur = this.items.get(item.id);
      if (!cur || compareVersions(pack.contentVersion, cur.version) >= 0) {
        this.items.set(item.id, { item, version: pack.contentVersion, retired: false });
      }
    }
    if (newest) {
      for (const [id, entry] of this.items) if (!ids.has(id) && entry.item.kind !== 'species') entry.retired = true;
      this.latest = pack.contentVersion;
    }
    for (const [ref, model] of Object.entries(pack.models)) {
      if (newest || !this.models.has(ref)) this.models.set(ref, model);
    }
  }

  /** Any known item, including retired ones (owned items must render). */
  get(id: string): PackItem | undefined {
    return this.items.get(id)?.item;
  }

  isRetired(id: string): boolean {
    return this.items.get(id)?.retired ?? false;
  }

  all<K extends keyof ByKind>(kind: K): ByKind[K][] {
    return [...this.items.values()].filter((e) => e.item.kind === kind).map((e) => e.item as ByKind[K]);
  }

  /** Items the shop may offer now: purchasable, not retired, inside their window, renderable by this app. */
  listed<K extends ItemKind>(kind: K, now: number, clientVersion: string): ByKind[K][] {
    return [...this.items.values()]
      .filter((e) => e.item.kind === kind && !e.retired)
      .map((e) => e.item as ByKind[K])
      .filter((i) => i.purchasable && isAvailable(i, now, clientVersion));
  }

  model(ref: string): VoxelModel | undefined {
    return this.models.get(ref);
  }
}
