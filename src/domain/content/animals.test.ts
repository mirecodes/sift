import { describe, expect, it } from 'vitest';
import { PALETTE_KEYS } from '../../../shared/content/palette';
import { CATALOG } from '../animals/catalog';
import { content } from './index';

const HEIGHT_BY_TIER = { common: [3, 5], mythic: [5, 7], epic: [7, 10], legendary: [10, 12] } as const;

describe('animal models (content/animals/<id>/model.ts, DESIGN.md 16)', () => {
  it('has its own model in its folder for every animal', () => {
    for (const a of CATALOG) {
      expect(a.modelId).toBe(`animals/${a.id}`);
      expect(content.model(a.modelId)).toBeDefined();
    }
  });

  describe.each(CATALOG.map((a) => [a.id, a] as const))('%s', (_id, species) => {
    const model = content.model(species.modelId)!;
    const [W, H, D] = model.size;

    it('fits inside one tile (at most 6 wide; 6 deep, or 8 for Legendary and Mythic, ADR-025)', () => {
      expect(W).toBeLessThanOrEqual(6);
      expect(D).toBeLessThanOrEqual(species.tier === 'legendary' || species.tier === 'epic' ? 8 : 6);
    });

    it('has a height that matches its tier', () => {
      const [min, max] = HEIGHT_BY_TIER[species.tier];
      expect(H).toBeGreaterThanOrEqual(min);
      expect(H).toBeLessThanOrEqual(max);
      expect(Math.max(...model.voxels.map((v) => v[1])) + 1).toBe(H);
    });

    it('keeps every voxel in bounds and uses only palette colors', () => {
      for (const [x, y, z, c] of model.voxels) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(W);
        expect(y).toBeLessThan(H);
        expect(z).toBeLessThan(D);
        expect(model.palette[model.keys[c]!]).toBeDefined();
      }
    });

    it('respects the palette budget and has an eye', () => {
      const colors = Object.values(model.palette);
      expect(colors.length).toBeLessThanOrEqual(species.tier === 'legendary' ? 8 : 6);
      expect(model.palette.eye?.toUpperCase()).toBe('#1E1E1E');
    });

    it('paints with named palette keys only (Step 3.0)', () => {
      expect(Object.keys(model.keys).length).toBe(Object.keys(model.palette).length);
      for (const key of Object.values(model.keys)) expect(PALETTE_KEYS).toContain(key);
    });

    it('has no duplicate voxel positions', () => {
      const keys = model.voxels.map((v) => `${v[0]},${v[1]},${v[2]}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
