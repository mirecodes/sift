import { describe, expect, it } from 'vitest';
import { isAnimalPart } from '../../../shared/content/anatomy';
import { restPose } from '../../../shared/content/model';
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
    const raw = content.model(species.modelId)!;
    const model = restPose(raw);
    const [W, H, D] = model.size;

    it('fits inside its size limits (width 8, flat wingspan 14; depth 8, or 12 for Epic and Legendary, ADR-055)', () => {
      expect(W).toBeLessThanOrEqual(species.idleAnimation === 'flutter' ? 14 : 8);
      expect(D).toBeLessThanOrEqual(species.tierRank >= 2 ? 12 : 8);
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

    it('has no duplicate voxel positions, parts included', () => {
      const keys = model.voxels.map((v) => `${v[0]},${v[1]},${v[2]}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('shows its eyes as two separate dots (DESIGN.md 16.2)', () => {
      const eyes = model.voxels.filter(([, , , c]) => model.keys[c] === 'eye');
      if (eyes.length !== 2) return; // the eye key also paints stripes or patches (tiger, bee, panda…)
      const [a, b] = [eyes[0]!, eyes[1]!];
      const touching = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1;
      expect(touching).toBe(false);
    });

    it('articulates with anatomy parts when it has a rig (ADR-055)', () => {
      const parts = Object.keys(raw.parts ?? {});
      for (const p of parts) expect(isAnimalPart(p), p).toBe(true);
      if (species.rig) expect(parts.length).toBeGreaterThan(0);
      else expect(parts).toEqual([]);
    });
  });

  it('keeps look-alikes apart: chick and duck differ in silhouette (DESIGN.md 16.2)', () => {
    const size = (id: string) => restPose(content.model(`animals/${id}`)!).size;
    expect(size('chick')).not.toEqual(size('duck'));
    expect(size('duck')[2]).toBeGreaterThan(size('chick')[2]); // the duck is long
  });

  it('draws long animals longer than tall (tiger, horse, wolf, cow)', () => {
    for (const id of ['tiger', 'wolf', 'cow', 'horse']) {
      const [, h, d] = restPose(content.model(`animals/${id}`)!).size;
      expect(d, id).toBeGreaterThanOrEqual(h);
    }
  });
});
