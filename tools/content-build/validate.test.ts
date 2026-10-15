import { describe, expect, it } from 'vitest';
import { balance } from '../../shared/balance/balance';
import type { VoxelModel } from '../../shared/content/model';
import type { ContentPack } from '../../shared/content/pack';
import type { BuildingDef } from '../../shared/content/schema';
import { spriteInputHash } from '../../shared/content/sprites';
import { validateContent } from '../../shared/content/validate';
import { contentProblems } from './validate';

const box = (w: number, h: number, d: number, n = w * h * d): VoxelModel => ({
  size: [w, h, d],
  keys: { 1: 'wood' },
  palette: { wood: '#B98552' },
  voxels: Array.from({ length: n }, (_, i) => [i % w, Math.floor(i / w) % h, Math.floor(i / (w * h)) % d, 1] as const),
});
const building = (id: string, extra: Partial<BuildingDef> = {}): BuildingDef => ({
  kind: 'building', id, name: { en: id, ko: id }, purchasable: true, price: 20, release: 'r', category: 'decor',
  footprint: { w: 1, d: 1 }, model: `buildings/${id}`, rotatable: true, ...extra,
});
const opts = { prices: balance.prices };

describe('content:validate (Step 3.5)', () => {
  it('the shipped content passes every check, sprites included', () => {
    expect(contentProblems()).toEqual([]);
  });

  it('checks footprints, budgets, prices and dates', () => {
    const pack: ContentPack = {
      contentVersion: '1',
      items: [
        building('ok'),
        building('wide', { footprint: { w: 1, d: 1 } }),
        building('huge', { footprint: { w: 4, d: 1 } }),
        building('tall'),
        building('cheap', { price: 5 }),
        building('free', { purchasable: false, price: undefined }),
        building('noprice', { price: undefined }),
        building('dates', { availableFrom: '2026-12-01', availableUntil: '2026-11-01' }),
      ],
      models: {
        'buildings/ok': box(8, 8, 6),
        'buildings/wide': box(12, 4, 8),
        'buildings/huge': box(32, 4, 8, 10),
        'buildings/tall': box(4, 30, 4, 10),
        'buildings/cheap': box(8, 2, 8),
        'buildings/free': box(8, 2, 8),
        'buildings/noprice': box(8, 2, 8),
        'buildings/dates': box(8, 2, 8),
      },
    };
    const problems = validateContent(pack, opts).join('\n');
    expect(problems).not.toMatch(/^ok:/m);
    expect(problems).toMatch(/wide: footprint 1×1 does not match the model \(12×8 voxels = 2×1 tiles/);
    expect(problems).toMatch(/huge: footprint 4×1 over 3×3/);
    expect(problems).toMatch(/tall: model is 30 voxels high, over 24/);
    expect(problems).toMatch(/cheap: price 5 outside 10–80/);
    expect(problems).not.toMatch(/free:/);
    expect(problems).toMatch(/noprice: purchasable but has no price/);
    expect(problems).toMatch(/dates: availableFrom is not before availableUntil/);
  });

  it('reports missing and stale sprites and unknown skin keys', () => {
    const tiger: VoxelModel = { size: [1, 1, 1], keys: { 1: 'body' }, palette: { body: '#F28C28' }, voxels: [[0, 0, 0, 1]] };
    const pack: ContentPack = {
      contentVersion: '1',
      items: [
        { kind: 'species', id: 'tiger', name: { en: 'T', ko: 'T' }, tierRank: 3, idle: 'default', model: 'species/tiger', release: 'r' },
        { kind: 'animalSkin', id: 'white', name: { en: 'W', ko: 'W' }, purchasable: true, price: 80, release: 'r', speciesId: 'tiger', palette: { body: '#FFFFFF', horn: '#000000' } },
      ],
      models: { 'species/tiger': tiger },
    };
    const atlas = { size: 48, width: 96, height: 48, frames: { tiger: [0, 0, 'stale'] as const } };
    const problems = validateContent(pack, { ...opts, atlas }).join('\n');
    expect(problems).toMatch(/tiger: sprite is out of date/);
    expect(problems).toMatch(/white: no sprite/);
    expect(problems).toMatch(/white: palette key horn is not used by tiger/);
    const fresh = { size: 48, width: 96, height: 48, frames: { tiger: [0, 0, spriteInputHash(pack.items[0]!, pack)] as const, white: [48, 0, spriteInputHash(pack.items[1]!, pack)] as const } };
    expect(validateContent({ ...pack, items: [pack.items[0]!] }, { ...opts, atlas: fresh })).toEqual([]);
  });
});
