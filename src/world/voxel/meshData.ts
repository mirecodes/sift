import type { PaletteKey } from '../../../shared/content/palette';
import { resolveColors, type VoxelModel } from '../../assets/voxels/types';

/** Plain typed arrays, so geometry generation is testable without three.js. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

type Vec3 = readonly [number, number, number];

export function hexToLinearRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

export class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  get faceCount(): number {
    return this.indices.length / 6;
  }

  /** Adds a quad; corners are counter-clockwise seen from outside (normal side). */
  quad(v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3, normal: Vec3, rgb: readonly [number, number, number]): void {
    const base = this.positions.length / 3;
    for (const v of [v0, v1, v2, v3]) {
      this.positions.push(v[0], v[1], v[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(rgb[0], rgb[1], rgb[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

interface Face {
  normal: Vec3;
  /** Unit-cube corners, counter-clockwise from outside. */
  corners: readonly [Vec3, Vec3, Vec3, Vec3];
}

const FACES: readonly Face[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

/**
 * Voxel model to one merged mesh: hidden faces culled, vertex colors, origin at the
 * bottom center of the model (x and z centered, y = 0 at the feet).
 */
export function buildVoxelMesh(model: VoxelModel, voxelSize: number, override?: Partial<Record<PaletteKey, string>>): MeshData {
  const [W, , D] = model.size;
  const filled = new Map<string, number>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const [x, y, z, c] of model.voxels) filled.set(key(x, y, z), c);

  const colors = new Map<number, [number, number, number]>();
  for (const [index, hex] of Object.entries(resolveColors(model, override))) colors.set(Number(index), hexToLinearRgb(hex));

  const mesh = new MeshBuilder();
  for (const [x, y, z, c] of model.voxels) {
    const rgb = colors.get(c) as [number, number, number];
    for (const face of FACES) {
      const [nx, ny, nz] = face.normal;
      if (filled.has(key(x + nx, y + ny, z + nz))) continue;
      const p = face.corners.map(
        ([cx, cy, cz]) => [(x + cx - W / 2) * voxelSize, (y + cy) * voxelSize, (z + cz - D / 2) * voxelSize] as const,
      ) as [Vec3, Vec3, Vec3, Vec3];
      mesh.quad(p[0], p[1], p[2], p[3], face.normal, rgb);
    }
  }
  return mesh.build();
}

/**
 * Unit terrain block centered on the origin, with a flat top color and a side color.
 * With `lowerSide`, the top quarter of each side uses `side` and the rest `lowerSide`
 * (the grass edge over dirt). The bottom face is never visible and is omitted.
 */
export function buildBlockMesh(top: string, side: string, lowerSide?: string): MeshData {
  const mesh = new MeshBuilder();
  const topRgb = hexToLinearRgb(top);
  const sideRgb = hexToLinearRgb(side);
  const lowerRgb = lowerSide ? hexToLinearRgb(lowerSide) : sideRgb;
  const split = lowerSide ? 0.25 : 1; // fraction of the height that uses `side`

  for (const face of FACES) {
    if (face.normal[1] === -1) continue;
    const at = (c: Vec3, yOverride?: number): Vec3 => [c[0] - 0.5, (yOverride ?? c[1]) - 0.5, c[2] - 0.5];
    if (face.normal[1] === 1) {
      const [a, b, c, d] = face.corners;
      mesh.quad(at(a), at(b), at(c), at(d), face.normal, topRgb);
      continue;
    }
    // Vertical face: corners are [bottom, top, top, bottom] or [bottom, bottom, top, top].
    const cornerAt = (c: Vec3, y: number): Vec3 => at(c, y);
    const [a, b, c, d] = face.corners;
    const cut = 1 - split;
    if (lowerSide) {
      const lower = [a, b, c, d].map((v) => cornerAt(v, v[1] === 1 ? cut : 0)) as [Vec3, Vec3, Vec3, Vec3];
      mesh.quad(lower[0], lower[1], lower[2], lower[3], face.normal, lowerRgb);
      const upper = [a, b, c, d].map((v) => cornerAt(v, v[1] === 1 ? 1 : cut)) as [Vec3, Vec3, Vec3, Vec3];
      mesh.quad(upper[0], upper[1], upper[2], upper[3], face.normal, sideRgb);
    } else {
      mesh.quad(at(a), at(b), at(c), at(d), face.normal, sideRgb);
    }
  }
  return mesh.build();
}
