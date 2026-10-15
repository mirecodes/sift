import { describe, expect, it } from 'vitest';
import type { BuildingDef } from '../../../shared/content/schema';
import { content } from '../content';
import { filterShop, itemBadges, newestRelease, NO_FILTER, shopView, type ShopFilter } from './shop';

const LAUNCH = Date.parse('2026-10-08T00:00:00Z');
const DAY = 86_400_000;
const ctx = (discovered: string[], now = LAUNCH + DAY) => ({ now, clientVersion: '0.1.0', discovered: new Set(discovered) });

describe('shop view (Step 3.9)', () => {
  it('features the newest started release and lists sections', () => {
    const view = shopView(ctx(['fox', 'tiger']));
    expect(view.featured?.release.id).toBe('v2-launch');
    expect(view.featured?.items.map((i) => i.id)).toEqual(['windmill', 'cherry', 'white-tiger', 'golden:fox', 'lantern']);
    expect(view.themes.map((t) => t.id)).toEqual(['autumn', 'snow', 'desert', 'cherry']);
    expect(view.buildings.map((g) => g.category)).toEqual(['structure', 'nature', 'light', 'decor']);
    expect(view.buildings.flatMap((g) => g.items.map((b) => b.id))).not.toContain('champion-flag');
  });

  it('sells skins only for species the user has earned, in catalog order', () => {
    const view = shopView(ctx(['tiger', 'fox']));
    expect(new Set(view.skins.map((s) => s.speciesId))).toEqual(new Set(['fox', 'tiger']));
    expect(view.skins[0]!.speciesId).toBe('fox'); // Epic before Legendary
    expect(view.skins.filter((s) => s.speciesId === 'tiger')).toHaveLength(6); // 5 families + White Tiger
    expect(shopView(ctx([])).skins).toEqual([]);
    // Featured skins of unknown species are left out.
    expect(shopView(ctx([])).featured?.items.map((i) => i.id)).toEqual(['windmill', 'cherry', 'lantern']);
  });

  it('filters by section, animal, style, owned and price (owner request)', () => {
    const view = shopView(ctx(['fox', 'tiger']));
    const none = () => false;
    const only = (f: Partial<ShopFilter>) => filterShop(view, { ...NO_FILTER, ...f }, none);
    expect(only({}).featured).not.toBeNull();
    const themes = only({ show: 'themes' });
    expect([themes.skins.length, themes.buildings.length, themes.themes.length, themes.featured]).toEqual([0, 0, 4, null]);
    expect(only({ species: 'tiger' }).skins.every((s) => s.speciesId === 'tiger')).toBe(true);
    expect(only({ family: 'golden' }).skins.map((s) => s.id)).toEqual(['golden:fox', 'golden:tiger']);
    expect(only({ family: 'handcrafted' }).skins.map((s) => s.id)).toEqual(['white-tiger']);
    const cheap = only({ maxPrice: 30 });
    expect([...cheap.skins, ...cheap.themes, ...cheap.buildings.flatMap((g) => g.items)].every((i) => (i.price ?? 0) <= 30)).toBe(true);
    const owned = filterShop(view, { ...NO_FILTER, hideOwned: true }, (id) => id === 'cherry' || id === 'lantern');
    expect(owned.themes.map((t) => t.id)).not.toContain('cherry');
    expect(owned.buildings.flatMap((g) => g.items.map((b) => b.id))).toContain('lantern'); // buildings can be bought again
  });

  it('a release in the future is not featured yet', () => {
    expect(newestRelease(LAUNCH - DAY)?.id).toBe('base');
    expect(newestRelease(LAUNCH)?.id).toBe('v2-launch');
  });

  it('marks items new for 14 days and shows how long limited items stay', () => {
    const lantern = content.get('lantern') as BuildingDef;
    expect(itemBadges(lantern, LAUNCH + DAY).isNew).toBe(true);
    expect(itemBadges(lantern, LAUNCH + 14 * DAY).isNew).toBe(false);
    expect(itemBadges(lantern, LAUNCH - DAY).isNew).toBe(false);
    expect(itemBadges(lantern, LAUNCH).leavesInMs).toBeUndefined();
    const limited: BuildingDef = { ...lantern, availableUntil: new Date(LAUNCH + 3 * DAY).toISOString() };
    expect(itemBadges(limited, LAUNCH).leavesInMs).toBe(3 * DAY);
  });
});
