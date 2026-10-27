import { describe, expect, it } from 'vitest';
import { layoutProblem } from '../../shared/content/pack';
import { ContentFile } from '../../shared/content/schema';
import { baselinePack } from '../../src/domain/content/baseline';
import { scaffold, type NewFile } from './new';

const ctx = {
  items: baselinePack.items,
  animalPalettes: { fox: { body: '#E8702A', belly: '#FFFFFF', eye: '#1E1E1E' } },
  today: '2026-10-27',
};

/** Every JSON file parses as content and sits where the layout expects it. */
function expectValid(files: NewFile[] | string) {
  expect(Array.isArray(files), String(files)).toBe(true);
  for (const f of files as NewFile[]) {
    if (!f.path.endsWith('.json')) continue;
    const def = ContentFile.parse(JSON.parse(f.text));
    expect(layoutProblem(f.path, def), f.path).toBeNull();
  }
  return files as NewFile[];
}

describe('content:new scaffold', () => {
  it('creates an animal folder with its data and a placeholder model', () => {
    const files = expectValid(scaffold(['animal', 'quokka', '--tier', 'epic', '--en', 'Quokka', '--ko', '쿼카'], ctx));
    expect(files.map((f) => f.path)).toEqual(['animals/quokka/animal.json', 'animals/quokka/model.ts']);
    expect(JSON.parse(files[0]!.text)).toMatchObject({ tierRank: 2, model: 'animals/quokka', name: { en: 'Quokka', ko: '쿼카' }, release: 'themes-oct-2026' });
    expect(files[1]!.text).toContain("from '../../../tools/content-build/animal'");
  });

  it('starts a skin from the animal colors, without the eye', () => {
    const [skin] = expectValid(scaffold(['skin', 'fox', 'arctic-fox'], ctx));
    expect(skin!.path).toBe('animals/fox/skins/arctic-fox.json');
    expect(JSON.parse(skin!.text)).toMatchObject({ speciesId: 'fox', palette: { body: '#E8702A', belly: '#FFFFFF' }, price: 60 });
    expect(JSON.parse(skin!.text).palette.eye).toBeUndefined();
  });

  it('creates themes, buildings, families and releases', () => {
    expect(expectValid(scaffold(['theme', 'lava'], ctx))[0]!.path).toBe('themes/lava.json');
    const building = expectValid(scaffold(['building', 'bench', '--size', '2x1', '--price', '30'], ctx));
    expect(JSON.parse(building[0]!.text)).toMatchObject({ footprint: { w: 2, d: 1 }, price: 30 });
    expect(building[1]!.text).toContain('model([16, 8, 8]');
    expect(expectValid(scaffold(['family', 'neon'], ctx))[0]!.path).toBe('skin-families/neon.json');
    expect(JSON.parse(expectValid(scaffold(['release', 'nov-2026'], ctx))[0]!.text).date).toBe('2026-10-27');
  });

  it('refuses taken ids, bad ids and unknown references', () => {
    expect(scaffold(['animal', 'fox'], ctx)).toBe('an item with id fox already exists');
    expect(scaffold(['animal', 'Big Cat'], ctx)).toMatch(/lowercase/);
    expect(scaffold(['animal', 'x', '--tier', 'rare'], ctx)).toMatch(/--tier/);
    expect(scaffold(['skin', 'dragon', 'red-dragon'], ctx)).toBe('unknown animal dragon');
    expect(scaffold(['theme', 'lava', '--release', 'nope'], ctx)).toBe('unknown release nope');
    expect(scaffold(['building', 'hall', '--size', '4x4'], ctx)).toMatch(/--size/);
    expect(scaffold([], ctx)).toMatch(/^usage/);
  });
});
