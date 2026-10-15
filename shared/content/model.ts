import type { PaletteKey } from './palette';

/** [x, y, z, paletteIndex]. Models face +Z, origin at bottom center (DESIGN.md 16). */
export type Voxel = readonly [x: number, y: number, z: number, paletteIndex: number];

export type ModelColors = Readonly<Partial<Record<PaletteKey, string>>>;

/** A movable part of a model (e.g. a windmill blade) with the point it turns around. */
export interface ModelPart {
  /** Pivot in voxel coordinates of the model. */
  pivot: readonly [number, number, number];
  voxels: readonly Voxel[];
}

/** Model JSON: what both authoring paths (MagicaVoxel import, builder DSL) produce (Step 3.3). */
export interface VoxelModel {
  /** Bounding box in voxels: [width (x), height (y), depth (z)]. */
  size: readonly [number, number, number];
  /** Palette index used by `voxels` → named palette key (Step 3.0). */
  keys: Readonly<Record<number, PaletteKey>>;
  /** Default color per key (the species' or building's own look). */
  palette: ModelColors;
  voxels: readonly Voxel[];
  parts?: Readonly<Record<string, ModelPart>>;
}

/** Index → color for one model under an optional palette override (a skin). */
export function resolveColors(model: VoxelModel, override?: ModelColors): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [index, key] of Object.entries(model.keys)) {
    const color = override?.[key] ?? model.palette[key];
    if (!color) throw new Error(`No color for palette key ${key}`);
    out[Number(index)] = color;
  }
  return out;
}

/** Number of voxels including parts. */
export const voxelCount = (m: VoxelModel): number =>
  m.voxels.length + Object.values(m.parts ?? {}).reduce((n, p) => n + p.voxels.length, 0);
