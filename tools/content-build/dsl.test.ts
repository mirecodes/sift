import { describe, expect, it } from 'vitest';
import { model } from './dsl';

const pos = (m: ReturnType<typeof model>) => m.voxels.map((v) => v.slice(0, 3).join(',')).sort();

describe('builder DSL (Step 3.3)', () => {
  it('paints boxes by key and renumbers palette indices in order of use', () => {
    const m = model([2, 2, 1], { stone: '#9A9DA3', wood: '#B98552', leaf: '#5FA83E' }, (b) => {
      b.paint('wood');
      b.box(0, 1, 0, 2, 1, 1);
      b.paint('stone');
      b.box(0, 0, 0, 2, 1, 1);
    });
    expect(m.keys).toEqual({ 1: 'stone', 2: 'wood' });
    expect(m.palette).toEqual({ stone: '#9A9DA3', wood: '#B98552' });
    expect(m.voxels).toEqual([[0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 2], [1, 1, 0, 2]]);
  });

  it('draws cylinders, stairs and mirrored shapes', () => {
    const c = model([5, 1, 5], { stone: '#9A9DA3' }, (b) => {
      b.paint('stone');
      b.cylinder(2.5, 0, 2.5, 1.5, 1);
    });
    expect(c.voxels).toHaveLength(9);
    const s = model([1, 3, 3], { wood: '#B98552' }, (b) => {
      b.paint('wood');
      b.stairs(0, 0, 0, 1, 3, '+z');
    });
    expect(pos(s)).toEqual(['0,0,0', '0,0,1', '0,0,2', '0,1,1', '0,1,2', '0,2,2']);
    const mirrored = model([4, 1, 1], { wood: '#B98552' }, (b) => {
      b.paint('wood');
      b.mirrorX(() => b.set(0, 0, 0));
    });
    expect(pos(mirrored)).toEqual(['0,0,0', '3,0,0']);
  });

  it('erases, keeps parts separate and fails loudly', () => {
    const m = model([3, 3, 1], { wood: '#B98552', roof: '#8A5A36' }, (b) => {
      b.paint('wood');
      b.box(0, 0, 0, 3, 3, 1);
      b.erase(1, 1, 0, 1, 1, 1);
      b.part('blade', [1, 1, 0], () => {
        b.paint('roof');
        b.set(1, 1, 0);
      });
    });
    expect(m.voxels).toHaveLength(8);
    expect(m.parts?.blade).toEqual({ pivot: [1, 1, 0], voxels: [[1, 1, 0, 2]] });
    expect(() => model([1, 1, 1], { wood: '#B98552' }, (b) => b.set(0, 0, 0))).toThrow(/paint/);
    expect(() => model([1, 1, 1], { wood: '#B98552' }, (b) => b.paint('roof'))).toThrow(/No color for palette key roof/);
    expect(() => model([1, 1, 1], { wood: '#B98552' }, (b) => { b.paint('wood'); b.set(1, 0, 0); })).toThrow(/outside/);
  });
});
