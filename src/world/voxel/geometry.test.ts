import { describe, expect, it } from 'vitest';
import { withOverlay, type VoxelModel } from '../../../shared/content/model';
import { content } from '../../domain/content';
import { baselinePack } from '../../domain/content/baseline';
import { buildIslandModel } from '../../domain/island/model';
import { newPlacedAnimal } from '../../domain/animals/placed';
import { getSpecies } from '../../domain/animals/catalog';
import { defaultBlocks } from '../palette';
import { animalGeometry, blockGeometries, buildingMeshes, skinColors, skinnedModel, themePalette } from './geometry';

const colorsOf = (g: ReturnType<typeof animalGeometry>) => [...(g.getAttribute('color').array as Float32Array)];

describe('skins and themes in the renderer (Step 3.8)', () => {
  it('builds one geometry per (species, skin) and reuses it', () => {
    const plain = animalGeometry('tiger');
    expect(animalGeometry('tiger', 'default')).toBe(plain);
    const white = animalGeometry('tiger', 'white-tiger');
    expect(white).not.toBe(plain);
    expect(animalGeometry('tiger', 'white-tiger')).toBe(white);
    expect(colorsOf(white)).not.toEqual(colorsOf(plain));
    // Same shape, other colors: the skin only recolors by palette key.
    expect(white.getAttribute('position').count).toBe(plain.getAttribute('position').count);
  });

  it('falls back to the default look for unknown or foreign skins', () => {
    expect(animalGeometry('fox', 'no-such-skin')).toBe(animalGeometry('fox'));
    expect(skinColors('cherry')).toBeUndefined(); // a theme is not a skin
  });

  it('family skins keep the eyes and change the body', () => {
    const golden = skinColors('golden:fox')!;
    expect(golden.eye).toBeUndefined();
    expect(golden.body).not.toBe(skinnedModel('fox').palette.body);
  });

  it('overlays add voxels on top of the species model', () => {
    const base: VoxelModel = { size: [2, 2, 1], keys: { 1: 'body' }, palette: { body: '#111111' }, voxels: [[0, 0, 0, 1], [1, 0, 0, 1]] };
    const hat: VoxelModel = { size: [2, 3, 1], keys: { 1: 'accent' }, palette: { accent: '#FF0000' }, voxels: [[0, 2, 0, 1], [1, 0, 0, 1]] };
    const m = withOverlay(base, hat);
    expect(m.size).toEqual([2, 3, 1]);
    expect(m.voxels).toHaveLength(3);
    expect(m.palette).toEqual({ body: '#111111', accent: '#FF0000' });
    expect(m.voxels.find((v) => v[0] === 1 && v[1] === 0)![3]).toBe(2); // the overlay wins its cell
  });

  it('a theme swaps block colors, cached per theme, and unknown themes fall back', () => {
    expect(themePalette('default')).toBe(defaultBlocks);
    expect(themePalette('nope')).toBe(defaultBlocks);
    const snow = themePalette('snow');
    expect(snow.grassTop).toBe('#F4F8FF');
    expect(blockGeometries(snow)).toBe(blockGeometries(snow));
    expect(blockGeometries(snow).grass).not.toBe(blockGeometries(defaultBlocks).grass);
  });

  it('equipped items reach the island model the renderer draws', () => {
    const fox = newPlacedAnimal('f', getSpecies('fox'), { x: 1, z: 1 }, 0, 's');
    const model = buildIslandModel({
      world: { seed: 1, blockThemeId: 'default' },
      islandLevel: 1,
      animals: [fox],
      equipped: { skinBySpecies: { fox: 'golden:fox' }, blockThemeId: 'cherry' },
      buildings: [{ id: 'b', defId: 'lantern', tileX: 2, tileZ: 2, rotation: 90, placedAt: 0 }],
    });
    expect(model.blockThemeId).toBe('cherry');
    expect(model.animals[0]!.skinId).toBe('golden:fox');
    expect(model.buildings).toEqual([{ id: 'b', defId: 'lantern', tile: { x: 2, z: 2 }, rotation: 90 }]);
    expect(themePalette(model.blockThemeId).cabinRoof).toBe('#C7738F');
  });

  it('buildings: parts around their pivot and lit voxels for lights', () => {
    const mill = buildingMeshes('windmill')!;
    expect(mill.parts.map((p) => [p.name, p.preset])).toEqual([['blade', 'spin']]);
    expect(mill.glow).toBeNull();
    const lantern = buildingMeshes('lantern')!;
    expect(lantern.glow).not.toBeNull();
    expect(lantern.lightAt[1]).toBeGreaterThan(1);
    expect(buildingMeshes('nope')).toBeNull();
    expect(content.get('lantern')).toBeDefined();
    expect(baselinePack.models['buildings/lantern']).toBeDefined();
  });
});
