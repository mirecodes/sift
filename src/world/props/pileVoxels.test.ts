import { describe, expect, it } from 'vitest';
import { PILE_VOXEL, pileVoxels } from './pileVoxels';

describe('pileVoxels', () => {
  it('is empty at level 0 and grows with every level', () => {
    const counts = [0, 1, 2, 3, 4, 5, 6].map((l) => pileVoxels(l).length);
    expect(counts[0]).toBe(0);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]!);
    expect(pileVoxels(99)).toEqual(pileVoxels(6));
  });

  it('stays inside its tile, rests on the ground and has no duplicate voxels', () => {
    const top = pileVoxels(6);
    expect(top.every(([x, y, z]) => Math.abs(x * PILE_VOXEL) < 0.5 && Math.abs(z * PILE_VOXEL) < 0.5 && y >= 0)).toBe(true);
    expect(new Set(top.map((v) => v.join())).size).toBe(top.length);
    expect(top.length).toBeLessThan(200); // one instanced mesh, small
  });
});
