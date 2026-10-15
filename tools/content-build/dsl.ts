import { canonicalModel, type ModelPart, type Voxel, type VoxelModel } from '../../shared/content/model';
import type { PaletteKey } from '../../shared/content/palette';

/**
 * Builder DSL for geometric decorations (guidance_v2 Step 3.3): fences, lanterns, wells, signs.
 * Coordinates are voxels, x right, y up, z toward the viewer (+Z is the front). Paint with a palette
 * key, then draw; later shapes overwrite earlier ones. `npm run content:build` evaluates every
 * `content/models/**\/*.ts` file to model JSON, the same format the MagicaVoxel import produces.
 */
export interface Dsl {
  /** Key used by the following shapes. */
  paint(key: PaletteKey): void;
  set(x: number, y: number, z: number): void;
  box(x: number, y: number, z: number, w: number, h: number, d: number): void;
  /** Upright cylinder: every voxel whose center is within `r` of (cx, cz), `h` high from `y`. */
  cylinder(cx: number, y: number, cz: number, r: number, h: number): void;
  /** `steps` stairs of 1×1, `w` wide, climbing toward `dir` from (x, y, z). */
  stairs(x: number, y: number, z: number, w: number, steps: number, dir: '+x' | '-x' | '+z' | '-z'): void;
  erase(x: number, y: number, z: number, w: number, h: number, d: number): void;
  /** Runs `draw` twice: as written and mirrored across the model's center plane (x flipped). */
  mirrorX(draw: () => void): void;
  /** Voxels drawn inside `draw` form a named part that turns around `pivot` (Step 3.2 presets). */
  part(name: string, pivot: readonly [number, number, number], draw: () => void): void;
}

export function model(size: readonly [number, number, number], palette: Partial<Record<PaletteKey, string>>, build: (m: Dsl) => void): VoxelModel {
  const [W, H, D] = size;
  const index = new Map<PaletteKey, number>();
  let current: PaletteKey | undefined;
  let mirror = false;
  let target = new Map<string, Voxel>();
  const main = target;
  const parts: Record<string, ModelPart & { cells: Map<string, Voxel> }> = {};

  const put = (x: number, y: number, z: number, erase = false) => {
    const xs = mirror ? [x, W - 1 - x] : [x];
    for (const px of xs) {
      if (px < 0 || y < 0 || z < 0 || px >= W || y >= H || z >= D) throw new Error(`Voxel (${px}, ${y}, ${z}) is outside size [${W}, ${H}, ${D}]`);
      const k = `${px},${y},${z}`;
      if (erase) {
        target.delete(k);
        continue;
      }
      if (!current) throw new Error('paint(key) before drawing');
      target.set(k, [px, y, z, index.get(current)!]);
    }
  };
  const fill = (x: number, y: number, z: number, w: number, h: number, d: number, erase = false) => {
    for (let j = y; j < y + h; j++) for (let k = z; k < z + d; k++) for (let i = x; i < x + w; i++) put(i, j, k, erase);
  };

  build({
    paint(key) {
      if (!palette[key]) throw new Error(`No color for palette key ${key}`);
      if (!index.has(key)) index.set(key, index.size + 1);
      current = key;
    },
    set: (x, y, z) => put(x, y, z),
    box: (x, y, z, w, h, d) => fill(x, y, z, w, h, d),
    cylinder(cx, y, cz, r, h) {
      for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) for (let j = y; j < y + h; j++) put(x, j, z);
      }
    },
    stairs(x, y, z, w, steps, dir) {
      for (let s = 0; s < steps; s++) {
        const along = dir[0] === '+' ? s : -s;
        if (dir[1] === 'z') fill(x, y, z + along, w, s + 1, 1);
        else fill(x + along, y, z, 1, s + 1, w);
      }
    },
    erase: (x, y, z, w, h, d) => fill(x, y, z, w, h, d, true),
    mirrorX(draw) {
      const was = mirror;
      mirror = true;
      draw();
      mirror = was;
    },
    part(name, pivot, draw) {
      if (parts[name]) throw new Error(`Part ${name} defined twice`);
      const cells = new Map<string, Voxel>();
      const was = target;
      target = cells;
      draw();
      target = was;
      parts[name] = { pivot, voxels: [], cells };
    },
  });

  const keys: Record<number, PaletteKey> = {};
  for (const [key, i] of index) keys[i] = key;
  const out: VoxelModel = {
    size,
    keys,
    palette,
    voxels: [...main.values()],
    ...(Object.keys(parts).length
      ? { parts: Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, { pivot: p.pivot, voxels: [...p.cells.values()] }])) }
      : {}),
  };
  return canonicalModel(out);
}
