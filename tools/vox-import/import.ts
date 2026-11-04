import { canonicalModel, type ModelPart, type Voxel, type VoxelModel } from '../../shared/content/model';
import { PALETTE_KEYS, type PaletteKey } from '../../shared/content/palette';
import type { VoxScene } from './vox';

/**
 * Palette template (docs/guides/CONTENT.md): color index i (1…) paints `PALETTE_KEYS[i - 1]`; its color in the
 * file is that key's default color. Index 255 marks a part's pivot and is never drawn.
 */
export const PIVOT_INDEX = 255;
export const keyForIndex = (i: number): PaletteKey | undefined => PALETTE_KEYS[i - 1];

/** Objects with no name (or named `main`) form the body; every other name becomes a part. */
const MAIN = new Set([undefined, '', 'main']);

export class VoxImportError extends Error {
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = 'VoxImportError';
  }
}

/**
 * MagicaVoxel scene → model JSON. MagicaVoxel is z-up: its (x, y, z) becomes Sift (x, z, y), so the
 * model's front (+Z in Sift) is +y in MagicaVoxel. Objects are placed by their translation, then the
 * whole model is shifted to start at 0.
 */
export function voxToModel(scene: VoxScene, opts: { file?: string; parts?: readonly string[] } = {}): VoxelModel {
  const file = opts.file ?? 'model.vox';
  type Cell = { x: number; y: number; z: number; i: number; part?: string };
  const cells: Cell[] = [];
  for (const o of scene.objects) {
    const name = o.name ?? o.layer;
    const part = MAIN.has(name) ? undefined : name;
    const [sx, sy, sz] = o.model.size;
    for (const [vx, vy, vz, i] of o.model.voxels) {
      const wx = o.t[0] + vx - Math.floor(sx / 2);
      const wy = o.t[1] + vy - Math.floor(sy / 2);
      const wz = o.t[2] + vz - Math.floor(sz / 2);
      cells.push({ x: wx, y: wz, z: wy, i, ...(part ? { part } : {}) });
    }
  }
  if (!cells.length) throw new VoxImportError(file, 'the model is empty');
  const min = (k: 'x' | 'y' | 'z') => Math.min(...cells.map((c) => c[k]));
  const max = (k: 'x' | 'y' | 'z') => Math.max(...cells.map((c) => c[k]));
  const [mx, my, mz] = [min('x'), min('y'), min('z')];
  const size = [max('x') - mx + 1, max('y') - my + 1, max('z') - mz + 1] as const;

  const keys: Record<number, PaletteKey> = {};
  const palette: Partial<Record<PaletteKey, string>> = {};
  const main: Voxel[] = [];
  const parts: Record<string, { pivot?: readonly [number, number, number]; voxels: Voxel[] }> = {};
  for (const c of cells) {
    const [x, y, z] = [c.x - mx, c.y - my, c.z - mz];
    if (c.i === PIVOT_INDEX) {
      if (!c.part) throw new VoxImportError(file, `pivot marker (index ${PIVOT_INDEX}) at (${x}, ${y}, ${z}) is outside a named part`);
      const p = (parts[c.part] ??= { voxels: [] });
      if (p.pivot) throw new VoxImportError(file, `part ${c.part} has more than one pivot marker`);
      p.pivot = [x, y, z];
      continue;
    }
    const key = keyForIndex(c.i);
    if (!key) {
      throw new VoxImportError(file, `voxel at (${x}, ${y}, ${z}) uses palette index ${c.i}, which is not a palette key. Use indices 1–${PALETTE_KEYS.length} from palette-template.vox (or ${PIVOT_INDEX} for a pivot).`);
    }
    keys[c.i] = key;
    palette[key] = scene.palette[c.i];
    const v: Voxel = [x, y, z, c.i];
    if (c.part) (parts[c.part] ??= { voxels: [] }).voxels.push(v);
    else main.push(v);
  }
  for (const [name, p] of Object.entries(parts)) {
    if (!p.pivot) throw new VoxImportError(file, `part ${name} has no pivot marker (one voxel of palette index ${PIVOT_INDEX})`);
    if (!p.voxels.length) throw new VoxImportError(file, `part ${name} has only a pivot marker`);
  }
  for (const name of opts.parts ?? []) {
    if (!parts[name]) throw new VoxImportError(file, `missing part ${name} (found: ${Object.keys(parts).join(', ') || 'none'})`);
  }
  const named = Object.entries(parts) as [string, ModelPart][];
  return canonicalModel({ size, keys, palette, voxels: main, ...(named.length ? { parts: Object.fromEntries(named) } : {}) });
}
