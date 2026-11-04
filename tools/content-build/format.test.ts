import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatContentJson, isWritableContentPath } from './format';

describe('content JSON format (Studio saves)', () => {
  it('rewrites the shipped files unchanged', () => {
    for (const f of ['animals/fox/animal.json', 'animals/tiger/skins/white-tiger.json', 'themes/default.json', 'buildings/well/building.json', 'releases/base.json']) {
      const text = readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8');
      const again = formatContentJson(JSON.parse(text));
      // Content stays the same; whitespace may differ only for files written by hand.
      expect(JSON.parse(again)).toEqual(JSON.parse(text));
      if (!f.startsWith('releases')) expect(again).toBe(text);
    }
  });

  it('only allows item files under content/', () => {
    for (const p of ['animals/fox/animal.json', 'animals/tiger/skins/white-tiger.json', 'buildings/well/building.json', 'themes/snow.json', 'skin-families/golden.json', 'releases/v2-launch.json']) {
      expect(isWritableContentPath(p), p).toBe(true);
    }
    for (const p of ['../package.json', 'models/x.json', 'presets.json', 'pack.json', 'buildings/../../x.json', 'buildings/well/model.ts', 'buildings/well/model.json', 'animals/fox/model.json', 'animals/../x/animal.json']) {
      expect(isWritableContentPath(p), p).toBe(false);
    }
  });
});
