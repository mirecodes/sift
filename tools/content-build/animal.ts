import type { PaletteKey } from '../../shared/content/palette';
import { isAnimalPart } from '../../shared/content/anatomy';
import type { ModelPart, Voxel, VoxelModel } from '../../shared/content/model';

export type Pivot = readonly [number, number, number];

export interface VoxelBuilder {
  /** Fills a box starting at (x, y, z) with dimensions (w, h, d). Later calls overwrite earlier ones. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void;
  /** Like `box`, and also fills the mirror image across the model's vertical center plane (x flipped). */
  boxM(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void;
  /** Sets a single voxel. */
  set(x: number, y: number, z: number, color: number): void;
  /** Sets a voxel and its x-mirror. */
  setM(x: number, y: number, z: number, color: number): void;
  /** Removes a box of voxels (carve), whichever part holds them. */
  erase(x: number, y: number, z: number, w: number, h: number, d: number): void;
  /**
   * Voxels drawn inside `draw` form the movable part `name` (an `ANIMAL_PARTS` name, ADR-055) that turns
   * around `pivot`, in voxel-center coordinates (voxel i spans i - 0.5 … i + 0.5, so a joint on the top
   * face of voxel y = 2 is at y = 2.5).
   */
  part(name: string, pivot: Pivot, draw: () => void): void;
  /**
   * A mirrored pair: `draw` as written becomes `<name>L` (the low-x side) and its x-mirror `<name>R`,
   * pivot mirrored too. Use `box`/`set` inside, not the mirror helpers.
   */
  pair(name: string, pivot: Pivot, draw: () => void): void;
}

/** Palette index → [palette key, default color]. Builder calls paint with the index. */
export type ModelPalette = Readonly<Record<number, readonly [PaletteKey, string]>>;

const MAIN = '';

/**
 * Authoring helper: describe a model with boxes, get the plain `VoxelModel` format.
 * Throws on out-of-range coordinates, unknown palette indexes or part names so mistakes fail loudly.
 * A cell belongs to whoever drew it last (body or part).
 */
export function defineModel(
  size: readonly [number, number, number],
  palette: ModelPalette,
  build: (b: VoxelBuilder) => void,
): VoxelModel {
  const [W, H, D] = size;
  const cells = new Map<number, { v: Voxel; owner: string }>();
  const id = (x: number, y: number, z: number) => (y * D + z) * W + x;
  const pivots = new Map<string, Pivot>();
  /** Parts drawn into right now: one, or the L/R pair (the second one mirrored). */
  let targets: readonly string[] = [MAIN];

  const put1 = (x: number, y: number, z: number, c: number, owner: string) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) {
      throw new Error(`Voxel (${x}, ${y}, ${z}) is outside size [${W}, ${H}, ${D}]`);
    }
    if (!(c in palette)) throw new Error(`Unknown palette index ${c}`);
    cells.set(id(x, y, z), { v: [x, y, z, c], owner });
  };
  const put = (x: number, y: number, z: number, c: number) => {
    put1(x, y, z, c, targets[0]!);
    if (targets[1] !== undefined) put1(W - 1 - x, y, z, c, targets[1]);
  };
  const fill = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) => {
    for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) for (let i = x; i < x + w; i++) put(i, j, k, c);
  };
  const open = (names: readonly string[], pivotsOf: readonly Pivot[], draw: () => void) => {
    if (targets.length !== 1 || targets[0] !== MAIN) throw new Error(`Part ${names.join('/')} drawn inside another part`);
    names.forEach((n, i) => {
      if (!isAnimalPart(n)) throw new Error(`Unknown animal part ${n} (shared/content/anatomy.ts)`);
      if (pivots.has(n)) throw new Error(`Part ${n} defined twice`);
      pivots.set(n, pivotsOf[i]!);
    });
    targets = names;
    try {
      draw();
    } finally {
      targets = [MAIN];
    }
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
      for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) for (let i = x; i < x + w; i++) {
        cells.delete(id(i, j, k));
        if (targets[1] !== undefined) cells.delete(id(W - 1 - i, j, k));
      }
    },
    part: (name, pivot, draw) => open([name], [pivot], draw),
    pair: (name, pivot, draw) => open([`${name}L`, `${name}R`], [pivot, [W - 1 - pivot[0], pivot[1], pivot[2]]], draw),
  });

  const keys: Record<number, PaletteKey> = {};
  const colors: Partial<Record<PaletteKey, string>> = {};
  for (const [index, [key, color]] of Object.entries(palette)) {
    if (key in colors) throw new Error(`Palette key ${key} used twice`);
    keys[Number(index)] = key;
    colors[key] = color;
  }
  const voxels: Voxel[] = [];
  const partVoxels = new Map<string, Voxel[]>();
  for (const { v, owner } of cells.values()) {
    if (owner === MAIN) voxels.push(v);
    else partVoxels.set(owner, [...(partVoxels.get(owner) ?? []), v]);
  }
  const parts: Record<string, ModelPart> = {};
  for (const [name, pivot] of pivots) {
    const vs = partVoxels.get(name);
    if (!vs?.length) throw new Error(`Part ${name} has no voxels`);
    parts[name] = { pivot, voxels: vs };
  }
  return { size, keys, palette: colors, voxels, ...(pivots.size ? { parts } : {}) };
}
