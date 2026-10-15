import type { PaletteKey } from '../../../shared/content/palette';

/** [x, y, z, paletteIndex]. Models face +Z, origin at bottom center (see DESIGN.md 16). */
export type Voxel = readonly [x: number, y: number, z: number, paletteIndex: number];

export interface VoxelModel {
  /** Bounding box in voxels: [width (x), height (y), depth (z)]. */
  size: readonly [number, number, number];
  /** Palette index used by `voxels` → named palette key (Step 3.0). */
  keys: Readonly<Record<number, PaletteKey>>;
  /** Default color per key (the species' or building's own look). */
  palette: Readonly<Partial<Record<PaletteKey, string>>>;
  voxels: readonly Voxel[];
}

/** Index → color for one model under an optional palette override (a skin). */
export function resolveColors(model: VoxelModel, override?: Readonly<Partial<Record<PaletteKey, string>>>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [index, key] of Object.entries(model.keys)) {
    const color = override?.[key] ?? model.palette[key];
    if (!color) throw new Error(`No color for palette key ${key}`);
    out[Number(index)] = color;
  }
  return out;
}
