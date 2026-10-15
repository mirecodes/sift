import { describe, expect, it } from 'vitest';
import { model } from '../content-build/dsl';
import { PIVOT_INDEX, voxToModel } from './import';
import { templateScene } from './main';
import { readVox, writeVox, type VoxScene } from './vox';

// Template indices: 1 body … 22 wood, 23 woodDark, 24 roof (PALETTE_KEYS order).
const WOOD = 22;
const ROOF = 24;
const palette = (() => {
  const p = Array.from({ length: 256 }, () => '#000000');
  p[WOOD] = '#B98552';
  p[ROOF] = '#8A5A36';
  p[PIVOT_INDEX] = '#FF00FF';
  return p;
})();

/** A 3×2×1 post (MagicaVoxel z-up) with a named 3-voxel `blade` part and its pivot. */
const scene = (blade: [number, number, number, number][] = [[0, 0, 0, ROOF], [1, 0, 0, ROOF], [2, 0, 0, ROOF], [1, 0, 1, PIVOT_INDEX]]): VoxScene => ({
  palette,
  objects: [
    { t: [0, 0, 1], model: { size: [1, 1, 3], voxels: [[0, 0, 0, WOOD], [0, 0, 1, WOOD], [0, 0, 2, WOOD]] } },
    { name: 'blade', t: [0, 1, 2], model: { size: [3, 1, 2], voxels: blade } },
  ],
});

describe('vox reader and writer', () => {
  it('round-trips models, names, translations and the palette', () => {
    const back = readVox(writeVox(scene()));
    expect(back.objects.map((o) => [o.name, o.t, o.model.size])).toEqual([[undefined, [0, 0, 1], [1, 1, 3]], ['blade', [0, 1, 2], [3, 1, 2]]]);
    expect(back.objects[1]!.model.voxels).toEqual(scene().objects[1]!.model.voxels);
    expect(back.palette[WOOD]).toBe('#B98552');
    expect(back.palette[PIVOT_INDEX]).toBe('#FF00FF');
  });

  it('rejects files that are not MagicaVoxel', () => {
    expect(() => readVox(new TextEncoder().encode('nope nope nope'))).toThrow(/MagicaVoxel/);
  });

  it('writes a palette template with one swatch per key', () => {
    const t = readVox(writeVox(templateScene()));
    expect(t.objects[0]!.model.voxels.length).toBe(37);
    expect(t.palette[PIVOT_INDEX]).toBe('#FF00FF');
  });
});

describe('vox import (Step 3.3)', () => {
  it('converts z-up to y-up, keys by template index and splits named parts with their pivot', () => {
    const m = voxToModel(readVox(writeVox(scene())));
    expect(m.size).toEqual([3, 3, 2]);
    expect(Object.values(m.keys).sort()).toEqual(['roof', 'wood']);
    expect(m.palette).toEqual({ wood: '#B98552', roof: '#8A5A36' });
    expect(m.voxels.map((v) => v.slice(0, 3))).toEqual([[1, 0, 0], [1, 1, 0], [1, 2, 0]]);
    expect(m.parts?.blade?.pivot).toEqual([1, 2, 1]);
    expect(m.parts?.blade?.voxels.map((v) => v.slice(0, 3))).toEqual([[0, 1, 1], [1, 1, 1], [2, 1, 1]]);
  });

  it('fails with clear messages', () => {
    const unknown = scene([[0, 0, 0, 200], [1, 0, 1, PIVOT_INDEX]]);
    expect(() => voxToModel(unknown, { file: 'mill.vox' })).toThrow(/mill\.vox: voxel at .* uses palette index 200, which is not a palette key/);
    expect(() => voxToModel(scene([[0, 0, 0, ROOF]]))).toThrow(/part blade has no pivot marker/);
    expect(() => voxToModel(scene(), { parts: ['blade', 'tail'] })).toThrow(/missing part tail \(found: blade\)/);
    const stray: VoxScene = { palette, objects: [{ t: [0, 0, 0], model: { size: [1, 1, 1], voxels: [[0, 0, 0, PIVOT_INDEX]] } }] };
    expect(() => voxToModel(stray)).toThrow(/outside a named part/);
  });
});

describe('both authoring paths give identical JSON (Step 3.3)', () => {
  it('a DSL model equals the same shape imported from .vox', () => {
    const viaDsl = model([3, 3, 2], { wood: '#B98552', roof: '#8A5A36' }, (m) => {
      m.paint('wood');
      m.box(1, 0, 0, 1, 3, 1);
      m.part('blade', [1, 2, 1], () => {
        m.paint('roof');
        m.box(0, 1, 1, 3, 1, 1);
      });
    });
    expect(JSON.stringify(voxToModel(readVox(writeVox(scene()))))).toBe(JSON.stringify(viaDsl));
  });
});
