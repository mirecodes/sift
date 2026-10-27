import type { PaletteKey } from '../../shared/content/palette';
import type { Voxel, VoxelModel } from '../../shared/content/model';

export interface VoxelBuilder {
  /** Fills a box starting at (x, y, z) with dimensions (w, h, d). Later calls overwrite earlier ones. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void;
  /** Like `box`, and also fills the mirror image across the model's vertical center plane (x flipped). */
  boxM(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void;
  /** Sets a single voxel. */
  set(x: number, y: number, z: number, color: number): void;
  /** Sets a voxel and its x-mirror. */
  setM(x: number, y: number, z: number, color: number): void;
  /** Removes a box of voxels (carve). */
  erase(x: number, y: number, z: number, w: number, h: number, d: number): void;
}

/** Palette index → [palette key, default color]. Builder calls paint with the index. */
export type ModelPalette = Readonly<Record<number, readonly [PaletteKey, string]>>;

/**
 * Authoring helper: describe a model with boxes, get the plain `VoxelModel` format.
 * Throws on out-of-range coordinates or unknown palette indexes so mistakes fail loudly.
 */
export function defineModel(
  size: readonly [number, number, number],
  palette: ModelPalette,
  build: (b: VoxelBuilder) => void,
): VoxelModel {
  const [W, H, D] = size;
  const cells = new Map<number, Voxel>();
  const id = (x: number, y: number, z: number) => (y * D + z) * W + x;

  const put = (x: number, y: number, z: number, c: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) {
      throw new Error(`Voxel (${x}, ${y}, ${z}) is outside size [${W}, ${H}, ${D}]`);
    }
    if (!(c in palette)) throw new Error(`Unknown palette index ${c}`);
    cells.set(id(x, y, z), [x, y, z, c]);
  };
  const fill = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) => {
    for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) for (let i = x; i < x + w; i++) put(i, j, k, c);
  };

  build({
    box: fill,
    boxM: (x, y, z, w, h, d, c) => {
      fill(x, y, z, w, h, d, c);
      fill(W - x - w, y, z, w, h, d, c);
    },
    set: put,
    setM: (x, y, z, c) => {
      put(x, y, z, c);
      put(W - 1 - x, y, z, c);
    },
    erase: (x, y, z, w, h, d) => {
      for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) for (let i = x; i < x + w; i++) cells.delete(id(i, j, k));
    },
  });

  const keys: Record<number, PaletteKey> = {};
  const colors: Partial<Record<PaletteKey, string>> = {};
  for (const [index, [key, color]] of Object.entries(palette)) {
    if (key in colors) throw new Error(`Palette key ${key} used twice`);
    keys[Number(index)] = key;
    colors[key] = color;
  }
  return { size, keys, palette: colors, voxels: [...cells.values()] };
}
