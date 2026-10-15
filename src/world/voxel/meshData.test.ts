import { describe, expect, it } from 'vitest';
import type { VoxelModel } from '../../assets/voxels/types';
import { buildBlockMesh, buildVoxelMesh, hexToLinearRgb } from './meshData';

const model = (voxels: VoxelModel['voxels'], size: VoxelModel['size'] = [2, 2, 2]): VoxelModel => ({
  size,
  keys: { 1: 'body', 2: 'belly' },
  palette: { body: '#FF0000', belly: '#FFFFFF' },
  voxels,
});

const faces = (m: ReturnType<typeof buildVoxelMesh>) => m.indices.length / 6;

describe('buildVoxelMesh', () => {
  it('emits 6 faces for a single voxel', () => {
    const m = buildVoxelMesh(model([[0, 0, 0, 1]]), 1);
    expect(faces(m)).toBe(6);
    expect(m.positions.length).toBe(24 * 3);
    expect(m.indices.length).toBe(36);
  });

  it('culls the faces hidden between adjacent voxels', () => {
    expect(faces(buildVoxelMesh(model([[0, 0, 0, 1], [1, 0, 0, 1]]), 1))).toBe(10);
    expect(faces(buildVoxelMesh(model([[0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1], [1, 1, 0, 1]]), 1))).toBe(16);
  });

  it('keeps faces between voxels that are not adjacent', () => {
    expect(faces(buildVoxelMesh(model([[0, 0, 0, 1], [1, 1, 1, 1]]), 1))).toBe(12);
  });

  it('places the origin at the bottom center and applies the voxel size', () => {
    const m = buildVoxelMesh(model([[0, 0, 0, 1], [1, 1, 1, 1]]), 0.5);
    const xs = [], ys = [], zs = [];
    for (let i = 0; i < m.positions.length; i += 3) {
      xs.push(m.positions[i]!); ys.push(m.positions[i + 1]!); zs.push(m.positions[i + 2]!);
    }
    expect(Math.min(...xs)).toBeCloseTo(-0.5);
    expect(Math.max(...xs)).toBeCloseTo(0.5);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(1);
    expect(Math.min(...zs)).toBeCloseTo(-0.5);
    expect(Math.max(...zs)).toBeCloseTo(0.5);
  });

  it('winds triangles so that the geometric normal matches the stored normal', () => {
    const m = buildVoxelMesh(model([[0, 0, 0, 1]]), 1);
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
      const p = (i: number) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!];
      const v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      const stored = [m.normals[a * 3]!, m.normals[a * 3 + 1]!, m.normals[a * 3 + 2]!];
      expect(n[0]! * stored[0]! + n[1]! * stored[1]! + n[2]! * stored[2]!).toBeGreaterThan(0);
    }
  });

  it('writes linear vertex colors', () => {
    const m = buildVoxelMesh(model([[0, 0, 0, 2]]), 1);
    expect([m.colors[0], m.colors[1], m.colors[2]]).toEqual([1, 1, 1]);
    expect(hexToLinearRgb('#808080')[0]).toBeCloseTo(0.2158, 3);
  });
});

describe('buildBlockMesh', () => {
  it('omits the bottom face', () => {
    expect(faces(buildBlockMesh('#ffffff', '#000000'))).toBe(5);
  });

  it('splits the sides for a grass edge over dirt', () => {
    expect(faces(buildBlockMesh('#7BC950', '#5FA83E', '#86593A'))).toBe(1 + 4 * 2);
  });

  it('is centered on the origin and one unit large', () => {
    const m = buildBlockMesh('#ffffff', '#000000');
    const ys = [];
    for (let i = 1; i < m.positions.length; i += 3) ys.push(m.positions[i]!);
    expect(Math.min(...ys)).toBeCloseTo(-0.5);
    expect(Math.max(...ys)).toBeCloseTo(0.5);
  });
});
