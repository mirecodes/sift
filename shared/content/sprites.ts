import type { ContentPack, PackItem } from './pack';

/** Edge of one sprite in the atlas, in pixels (DESIGN.md 16.5). Shown at 2× with nearest-neighbor scaling. */
export const SPRITE_SIZE = 48;
/** Bump when the sprite renderer changes (camera, lighting, size): every sprite becomes stale. */
export const SPRITE_RENDERER_VERSION = 1;

/** Items that get a sprite: species (default look), skins, block themes, buildings. */
export const hasSprite = (item: PackItem): boolean => item.kind !== 'release';

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};

/**
 * Hash of everything a sprite is drawn from (model, colors, renderer version). The atlas stores it per
 * item; `content:validate` reports sprites whose inputs changed since `npm run content:sprites`.
 */
export function spriteInputHash(item: PackItem, pack: Pick<ContentPack, 'items' | 'models'>): string {
  const model = (ref: string | undefined) => (ref ? pack.models[ref] : undefined);
  let inputs: unknown;
  switch (item.kind) {
    case 'species':
      inputs = model(item.model);
      break;
    case 'animalSkin': {
      const species = pack.items.find((i) => i.kind === 'species' && i.id === item.speciesId);
      inputs = [species && 'model' in species ? model(species.model) : null, item.palette, model(item.overlay)];
      break;
    }
    case 'blockTheme':
      // Matte themes without tints hash exactly as before, so their sprites stay fresh.
      inputs = item.tileTints || item.finish ? [item.palette, item.tileTints ?? null, item.finish ?? 'matte'] : item.palette;
      break;
    case 'building':
      inputs = model(item.model);
      break;
    default:
      inputs = null;
  }
  return fnv(`${SPRITE_RENDERER_VERSION}|${item.kind}|${JSON.stringify(inputs)}`);
}

/** `content/sprites/atlas.json`: frame positions and input hashes by item id. */
export interface AtlasIndex {
  size: number;
  /** Atlas image size in pixels. */
  width: number;
  height: number;
  /** Item id → [x, y, inputHash]. */
  frames: Readonly<Record<string, readonly [number, number, string]>>;
}
