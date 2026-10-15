import { voxelCount, type VoxelModel } from './model';
import type { ContentPack, PackItem } from './pack';
import { PALETTE_KEYS } from './palette';
import { hasSprite, spriteInputHash, type AtlasIndex } from './sprites';

/** Size and voxel budgets (Step 3.5; DESIGN.md 16.4). */
export const BUDGETS = {
  animal: { maxEdge: 16, maxVoxels: 800 },
  building: { maxFootprint: 3, maxHeight: 24, maxVoxels: 3000, voxelsPerTile: 8 },
} as const;

export interface ValidateOptions {
  /** `balance.prices`: [min, max] per kind. */
  prices: Readonly<Record<'familySkin' | 'handcraftedSkin' | 'blockTheme' | 'building', readonly [number, number]>>;
  /** Omit to skip the sprite checks. */
  atlas?: AtlasIndex;
}

/**
 * Checks beyond the schema and references that `buildPack` already enforces (Step 3.5): palette keys,
 * budgets, footprint vs model bounds, price ranges, availability dates, and present, fresh sprites.
 */
export function validateContent(pack: ContentPack, opts: ValidateOptions): string[] {
  const problems: string[] = [];
  const keys = new Set<string>(PALETTE_KEYS);
  const model = (ref: string | undefined): VoxelModel | undefined => (ref ? pack.models[ref] : undefined);
  const species = new Map(pack.items.flatMap((i) => (i.kind === 'species' ? [[i.id, i] as const] : [])));

  for (const [ref, m] of Object.entries(pack.models)) {
    for (const key of Object.values(m.keys)) if (!keys.has(key)) problems.push(`model ${ref}: unknown palette key ${key}`);
  }
  const animalBudget = (owner: string, m: VoxelModel | undefined) => {
    if (!m) return;
    const { maxEdge, maxVoxels } = BUDGETS.animal;
    if (m.size.some((e) => e > maxEdge)) problems.push(`${owner}: model is ${m.size.join('×')}, over ${maxEdge}×${maxEdge}×${maxEdge}`);
    if (voxelCount(m) > maxVoxels) problems.push(`${owner}: model has ${voxelCount(m)} voxels, over ${maxVoxels}`);
  };
  const price = (item: Exclude<PackItem, { kind: 'species' | 'release' }>, range: readonly [number, number]) => {
    if (!item.purchasable) return;
    if (item.price === undefined) problems.push(`${item.id}: purchasable but has no price`);
    else if (item.price < range[0] || item.price > range[1]) problems.push(`${item.id}: price ${item.price} outside ${range[0]}–${range[1]}`);
  };

  for (const item of pack.items) {
    if ('availableFrom' in item && item.availableFrom && item.availableUntil && Date.parse(item.availableFrom) >= Date.parse(item.availableUntil)) {
      problems.push(`${item.id}: availableFrom is not before availableUntil`);
    }
    switch (item.kind) {
      case 'species':
        animalBudget(item.id, model(item.model));
        break;
      case 'animalSkin': {
        const base = model(species.get(item.speciesId)?.model);
        for (const key of Object.keys(item.palette)) {
          if (base && !Object.values(base.keys).includes(key as never)) problems.push(`${item.id}: palette key ${key} is not used by ${item.speciesId}`);
        }
        animalBudget(item.id, model(item.overlay));
        price(item, item.family ? opts.prices.familySkin : opts.prices.handcraftedSkin);
        break;
      }
      case 'blockTheme':
        price(item, opts.prices.blockTheme);
        break;
      case 'building': {
        const m = model(item.model);
        const b = BUDGETS.building;
        const { w, d } = item.footprint;
        if (w > b.maxFootprint || d > b.maxFootprint) problems.push(`${item.id}: footprint ${w}×${d} over ${b.maxFootprint}×${b.maxFootprint}`);
        if (m) {
          const [mw, mh, md] = m.size;
          if (mh > b.maxHeight) problems.push(`${item.id}: model is ${mh} voxels high, over ${b.maxHeight}`);
          if (voxelCount(m) > b.maxVoxels) problems.push(`${item.id}: model has ${voxelCount(m)} voxels, over ${b.maxVoxels}`);
          const tiles = (v: number) => Math.ceil(v / b.voxelsPerTile);
          if (tiles(mw) !== w || tiles(md) !== d) {
            problems.push(`${item.id}: footprint ${w}×${d} does not match the model (${mw}×${md} voxels = ${tiles(mw)}×${tiles(md)} tiles at ${b.voxelsPerTile} per tile)`);
          }
        }
        price(item, opts.prices.building);
        break;
      }
    }
    if (opts.atlas && hasSprite(item)) {
      const frame = opts.atlas.frames[item.id];
      if (!frame) problems.push(`${item.id}: no sprite (run npm run content:sprites)`);
      else if (frame[2] !== spriteInputHash(item, pack)) problems.push(`${item.id}: sprite is out of date (run npm run content:sprites)`);
    }
  }
  return problems;
}
