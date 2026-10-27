import { describe, expect, it } from 'vitest';
import type { VoxelModel } from './model';
import { BLOCK_PALETTE_KEYS } from './palette';
import { assemblePack, buildPack, compareVersions, ContentError, expandFamily, transformPalette, type PackSource } from './pack';
import type { SkinFamilyDef, SpeciesDef } from './schema';

const model: VoxelModel = { size: [1, 1, 1], keys: { 1: 'body', 2: 'eye' }, palette: { body: '#F28C28', eye: '#1E1E1E' }, voxels: [[0, 0, 0, 1]] };
const species = (id: string, tierRank: 0 | 1 | 2 | 3 = 0): SpeciesDef => ({ kind: 'species', id, name: { en: id, ko: id }, tierRank, idle: 'default', model: `species/${id}`, release: 'base' });
const release = { kind: 'release', id: 'base', date: '2026-09-29', name: { en: 'Base', ko: '기본' }, featured: [] };
const family: SkinFamilyDef = {
  kind: 'skinFamily', id: 'golden', name: { en: 'Golden', ko: '황금' }, release: 'base', purchasable: true,
  transform: { fixed: { body: '#F2C230' } }, priceByTierRank: [25, 30, 40, 60],
};

const source = (files: unknown[], ids = ['a', 'b']): PackSource => ({
  contentVersion: '2026-10-07.1',
  files: files.map((data, i) => ({ path: `f${i}.json`, data })),
  models: Object.fromEntries(ids.map((id) => [`species/${id}`, model])),
});

describe('content pack (Step 3.1)', () => {
  it('builds species, items and releases and keeps only used models', () => {
    const pack = buildPack({ ...source([[species('a'), species('b', 3)], release]), models: { 'species/a': model, 'species/b': model, 'species/unused': model } });
    expect(pack.items.map((i) => i.id)).toEqual(['a', 'b', 'base']);
    expect(Object.keys(pack.models)).toEqual(['species/a', 'species/b']);
  });

  it('collects every problem in one error', () => {
    const bad = [
      species('a'),
      species('a'),
      { ...species('c'), model: 'species/none' },
      { kind: 'animalSkin', id: 'x', name: { en: 'X' }, purchasable: true, release: 'base', speciesId: 'zebra', palette: { body: 'red' } },
      { kind: 'blockTheme', id: 'y', name: { en: 'Y', ko: 'Y' }, purchasable: true, release: 'nope', palette: {} },
      release,
    ];
    try {
      buildPack(source(bad));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      const text = (e as ContentError).problems.join('\n');
      expect(text).toMatch(/duplicate id a/);
      expect(text).toMatch(/c: model species\/none not found/);
      expect(text).toMatch(/name\.ko/);
      expect(text).toMatch(/palette\.body: colors are #RRGGBB/);
      expect(text).toMatch(/palette\.grassTop/);
    }
  });

  it('assemblePack keeps the valid entries next to the problems', () => {
    const { pack, problems } = assemblePack(source([species('a'), { ...species('b'), model: 'species/none' }, { kind: 'nope' }, release]));
    expect(pack.items.map((i) => i.id)).toEqual(['a', 'base']);
    expect(problems).toHaveLength(2);
  });

  it('rejects unknown presets when a preset list is given', () => {
    const presets = { idle: ['flop'], part: ['default'], particles: [], light: [] };
    expect(() => buildPack({ ...source([species('a'), release], ['a']), presets })).toThrow(/a: unknown idle preset default/);
    expect(() => buildPack({ ...source([species('a'), release], ['a']), presets: { ...presets, idle: ['default'] } })).not.toThrow();
  });

  it('expands a family into one skin per species with stable ids and tier prices', () => {
    const all = Array.from({ length: 50 }, (_, i) => species(`s${i}`, (i % 4) as 0 | 1 | 2 | 3));
    const models = Object.fromEntries(all.map((s) => [s.model, model]));
    const skins = expandFamily(family, all, models);
    expect(skins).toHaveLength(50);
    expect(skins.map((s) => s.id)).toEqual(all.map((s) => `golden:${s.id}`));
    expect(skins[3]).toMatchObject({ speciesId: 's3', family: 'golden', price: 60, palette: { body: '#F2C230' }, name: { en: 'Golden s3' } });
    expect(skins[3]!.palette.eye).toBeUndefined(); // eyes are kept by default
    expect(expandFamily(family, all, models)).toEqual(skins); // deterministic
  });

  it('applies per-species overrides', () => {
    const f = { ...family, overrides: { a: { palette: { eye: '#FFFFFF' as const }, price: 99 } } };
    const [a] = expandFamily(f, [species('a')], { 'species/a': model });
    expect(a).toMatchObject({ price: 99, palette: { body: '#F2C230', eye: '#FFFFFF' } });
  });

  it('transforms colors by hue, lightness and tint', () => {
    expect(transformPalette({ body: '#FF0000' }, { hueShift: 120 })).toEqual({ body: '#00FF00' });
    expect(transformPalette({ body: '#808080' }, { lightness: { offset: 1, scale: 0 } })).toEqual({ body: '#FFFFFF' });
    expect(transformPalette({ body: '#000000', eye: '#1E1E1E' }, { tint: { color: '#FFFFFF', amount: 0.5 } })).toEqual({ body: '#808080' });
  });

  it('checks that every item sits in its own folder or file (one folder per animal and building)', () => {
    const skin = { kind: 'animalSkin', id: 'white-tiger', name: { en: 'W', ko: 'W' }, purchasable: false, release: 'base', speciesId: 'a', palette: {} };
    const { problems } = assemblePack({
      ...source([]),
      files: [
        { path: 'animals/a/animal.json', data: species('a') },
        { path: 'animals/b/animal.json', data: species('a2') },
        { path: 'animals/a/skins/white-tiger.json', data: skin },
        { path: 'animals/b/skins/white-tiger.json', data: { ...skin, id: 'white-tiger-2' } },
        { path: 'themes/snow.json', data: species('b') },
        { path: 'releases/base.json', data: release },
      ],
      models: { 'species/a': model, 'species/a2': model, 'species/b': model },
    });
    expect(problems).toEqual([
      'animals/b/animal.json: id must be b (the folder name)',
      'animals/b/skins/white-tiger.json: id must be white-tiger (the file name)',
      'themes/snow.json: a species does not belong in themes/snow.json (expected a blockTheme)',
    ]);
  });

  it('orders items by release date, then id', () => {
    const later = { ...release, id: 'later', date: '2026-10-01' };
    const palette = Object.fromEntries(BLOCK_PALETTE_KEYS.map((k) => [k, '#FFFFFF']));
    const theme = (id: string, rel: string) => ({ kind: 'blockTheme', id, name: { en: id, ko: id }, purchasable: false, release: rel, palette });
    const { pack } = assemblePack(source([release, later, theme('z', 'base'), theme('b', 'later'), theme('a', 'later')]));
    expect(pack.items.filter((i) => i.kind === 'blockTheme').map((i) => i.id)).toEqual(['z', 'a', 'b']);
  });

  it('compares content versions number by number', () => {
    expect(compareVersions('2026-10-07.10', '2026-10-07.9')).toBeGreaterThan(0);
    expect(compareVersions('2026-10-07.1', '2026-10-07.1')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
  });
});
