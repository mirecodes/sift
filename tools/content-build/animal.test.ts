import { describe, expect, it } from 'vitest';
import { restPose } from '../../shared/content/model';
import { defineModel } from './animal';

const pos = (vs: readonly (readonly number[])[]) => vs.map((v) => v.slice(0, 3).join(',')).sort();

describe('defineModel parts (ADR-055)', () => {
  const m = defineModel([5, 3, 3], { 1: ['body', '#C9955C'], 2: ['eye', '#1E1E1E'] }, (b) => {
    b.box(1, 1, 0, 3, 1, 3, 1);
    b.part('head', [2, 1.5, 2], () => b.box(1, 2, 2, 3, 1, 1, 1));
    b.pair('leg', [1, 0.5, 1], () => b.set(1, 0, 1, 1));
    b.set(3, 2, 2, 2); // drawn after the head: moves that cell to the body
  });

  it('puts part voxels in their part with the pivot', () => {
    expect(m.parts!.head!.pivot).toEqual([2, 1.5, 2]);
    expect(pos(m.parts!.head!.voxels)).toEqual(['1,2,2', '2,2,2']);
    expect(pos(m.voxels)).toContain('3,2,2');
  });

  it('mirrors a pair into L (as drawn) and R (mirrored, pivot too)', () => {
    expect(pos(m.parts!.legL!.voxels)).toEqual(['1,0,1']);
    expect(pos(m.parts!.legR!.voxels)).toEqual(['3,0,1']);
    expect(m.parts!.legR!.pivot).toEqual([3, 0.5, 1]);
  });

  it('merges back into one voxel list for the rest pose', () => {
    expect(restPose(m).voxels).toHaveLength(m.voxels.length + 4);
    expect(restPose(m).parts).toBeUndefined();
  });

  it('rejects unknown part names, nested parts and empty parts', () => {
    const pal = { 1: ['body', '#C9955C'] } as const;
    expect(() => defineModel([2, 2, 2], pal, (b) => b.part('wheel', [0, 0, 0], () => b.set(0, 0, 0, 1)))).toThrow(/Unknown animal part/);
    expect(() => defineModel([2, 2, 2], pal, (b) => b.part('head', [0, 0, 0], () => b.part('tail', [0, 0, 0], () => b.set(0, 0, 0, 1))))).toThrow(/inside another part/);
    expect(() => defineModel([2, 2, 2], pal, (b) => b.part('head', [0, 0, 0], () => undefined))).toThrow(/no voxels/);
  });
});
