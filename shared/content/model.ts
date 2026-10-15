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

/**
 * One canonical form for model JSON, so both authoring paths give byte-identical output: voxels sorted
 * by (y, z, x), palette indices renumbered 1…n in order of first use (main voxels, then parts by name),
 * only used keys kept.
 */
export function canonicalModel(m: VoxelModel): VoxelModel {
  const order = (a: Voxel, b: Voxel) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0];
  const partNames = Object.keys(m.parts ?? {}).sort();
  const index = new Map<PaletteKey, number>();
  const remap = (vs: readonly Voxel[]) =>
    [...vs].sort(order).map(([x, y, z, c]): Voxel => {
      const key = m.keys[c];
      if (!key) throw new Error(`Voxel (${x}, ${y}, ${z}) uses palette index ${c} with no key`);
      if (!index.has(key)) index.set(key, index.size + 1);
      return [x, y, z, index.get(key)!];
    });
  const voxels = remap(m.voxels);
  const parts = Object.fromEntries(partNames.map((n) => [n, { pivot: m.parts![n]!.pivot, voxels: remap(m.parts![n]!.voxels) }]));
  const keys: Record<number, PaletteKey> = {};
  const palette: Partial<Record<PaletteKey, string>> = {};
  for (const [key, i] of index) {
    keys[i] = key;
    const color = m.palette[key];
    if (!color) throw new Error(`No color for palette key ${key}`);
    palette[key] = color.toUpperCase();
  }
  return { size: m.size, keys, palette, voxels, ...(partNames.length ? { parts } : {}) };
}

/**
 * A species model with a skin overlay drawn over it (Step 3.8): the overlay shares the model's origin;
 * its voxels win where both fill a cell and the size grows to fit both.
 */
export function withOverlay(base: VoxelModel, overlay: VoxelModel): VoxelModel {
  const keys: Record<number, PaletteKey> = { ...base.keys };
  const index = new Map(Object.entries(base.keys).map(([i, k]) => [k, Number(i)]));
  let next = Math.max(0, ...index.values()) + 1;
  const cells = new Map(base.voxels.map((v) => [`${v[0]},${v[1]},${v[2]}`, v]));
  for (const [x, y, z, c] of overlay.voxels) {
    const key = overlay.keys[c]!;
    if (!index.has(key)) {
      index.set(key, next);
      keys[next++] = key;
    }
    cells.set(`${x},${y},${z}`, [x, y, z, index.get(key)!]);
  }
  const size = [0, 1, 2].map((i) => Math.max(base.size[i]!, overlay.size[i]!)) as unknown as VoxelModel['size'];
  return { size, keys, palette: { ...overlay.palette, ...base.palette }, voxels: [...cells.values()] };
}

/** Number of voxels including parts. */
export const voxelCount = (m: VoxelModel): number =>
  m.voxels.length + Object.values(m.parts ?? {}).reduce((n, p) => n + p.voxels.length, 0);
