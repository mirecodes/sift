import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../../shared/content/pack';
import type { BlockThemeDef } from '../../../shared/content/schema';
import { CATALOG } from '../animals/catalog';
import { baselinePack, contentFiles } from './baseline';
import { ContentRegistry, isAvailable } from './registry';

const theme = (id: string, extra: Partial<BlockThemeDef> = {}): BlockThemeDef => ({
  kind: 'blockTheme', id, name: { en: id, ko: id }, purchasable: true, price: 150, release: 'r', palette: (baselinePack.items.find((i) => i.id === 'default') as BlockThemeDef).palette, ...extra,
});
const pack = (contentVersion: string, items: ContentPack['items'], models: ContentPack['models'] = {}): ContentPack => ({ contentVersion, items, models });
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('baseline pack (Step 3.1)', () => {
  it('accepts every shipped content file', () => {
    expect(contentFiles().length).toBeGreaterThan(0);
    expect(baselinePack.contentVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it('holds the 50 species with both locales, in catalog order, and their models', () => {
    const species = baselinePack.items.filter((i) => i.kind === 'species');
    expect(species).toHaveLength(50);
    expect(CATALOG.map((s) => s.id)).toEqual(species.map((s) => s.id));
    for (const s of species) {
      expect(s.name.ko.length).toBeGreaterThan(0);
      expect(baselinePack.models[s.model]).toBeDefined();
    }
  });
});

describe('ContentRegistry', () => {
  it('lets the newer pack win per item and keeps the older version otherwise', () => {
    const r = new ContentRegistry(pack('1', [theme('a', { price: 120 }), theme('b')]));
    r.merge(pack('2', [theme('a', { price: 130 }), theme('b')]));
    expect((r.get('a') as BlockThemeDef).price).toBe(130);
    r.merge(pack('1', [theme('a', { price: 999 })]));
    expect((r.get('a') as BlockThemeDef).price).toBe(130);
    expect(r.contentVersion).toBe('2');
  });

  it('keeps items a newer pack removed: still renderable, no longer listed', () => {
    const model = baselinePack.models['species/tiger']!;
    const r = new ContentRegistry(pack('1', [theme('a'), theme('gone')], { 'species/tiger': model }));
    r.merge(pack('2', [theme('a')]));
    expect(r.get('gone')).toBeDefined();
    expect(r.isRetired('gone')).toBe(true);
    expect(r.model('species/tiger')).toBe(model);
    expect(r.listed('blockTheme', NOW, '1.0.0').map((t) => t.id)).toEqual(['a']);
  });

  it('lists only purchasable items inside their window on a new enough app', () => {
    const r = new ContentRegistry(pack('1', [
      theme('open'),
      theme('free', { purchasable: false }),
      theme('later', { availableFrom: new Date(NOW + DAY).toISOString() }),
      theme('over', { availableUntil: new Date(NOW - DAY).toISOString() }),
      theme('limited', { availableFrom: '2026-11-01', availableUntil: '2026-11-20' }),
      theme('newer', { minClientVersion: '0.2.0' }),
    ]));
    expect(r.listed('blockTheme', NOW, '0.1.0').map((t) => t.id)).toEqual(['open', 'limited']);
    expect(r.listed('blockTheme', NOW, '0.2.0').map((t) => t.id)).toEqual(['open', 'limited', 'newer']);
  });

  it('treats availableUntil as exclusive', () => {
    const t = theme('x', { availableUntil: new Date(NOW).toISOString() });
    expect(isAvailable(t, NOW - 1, '1.0.0')).toBe(true);
    expect(isAvailable(t, NOW, '1.0.0')).toBe(false);
  });
});
