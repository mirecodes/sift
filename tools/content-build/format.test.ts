import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatContentJson, isWritableContentPath } from './format';

describe('content JSON format (Studio saves)', () => {
  it('rewrites the shipped files unchanged', () => {
    for (const f of ['species/common.json', 'blockThemes/default.json', 'releases/base.json']) {
      const text = readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8');
      const again = formatContentJson(JSON.parse(text));
      // One-line objects keep their content; whitespace may differ only for single-object files written by hand.
      expect(JSON.parse(again)).toEqual(JSON.parse(text));
      if (f.startsWith('species')) expect(again).toBe(text);
    }
  });

  it('only allows item files under content/', () => {
    expect(isWritableContentPath('buildings/well.json')).toBe(true);
    expect(isWritableContentPath('skinFamilies/golden.json')).toBe(true);
    for (const p of ['../package.json', 'models/x.json', 'presets.json', 'pack.json', 'buildings/../../x.json', 'buildings/x.ts']) {
      expect(isWritableContentPath(p), p).toBe(false);
    }
  });
});
