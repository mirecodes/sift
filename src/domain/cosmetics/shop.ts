import { balance } from '../../../shared/balance/balance';
import type { AnimalSkinDef, BlockThemeDef, BuildingDef, ItemDef, ReleaseDef } from '../../../shared/content/schema';
import { CATALOG } from '../animals/catalog';
import { content } from '../content';
import type { ShopContext } from './inventory';

const DAY = 86_400_000;

/** Shop sections for buildings, in display order (`special` items are never sold). */
export const BUILDING_CATEGORIES = ['structure', 'nature', 'light', 'decor'] as const;
export type ShopCategory = (typeof BUILDING_CATEGORIES)[number];

export interface ShopView {
  /** The newest release that has started, with its featured items that are for sale. */
  featured: { release: ReleaseDef; items: ItemDef[] } | null;
  /** Skins of species the user has earned, in catalog order. */
  skins: AnimalSkinDef[];
  themes: BlockThemeDef[];
  buildings: { category: ShopCategory; items: BuildingDef[] }[];
}

/** The newest release whose date has come. */
export function newestRelease(now: number): ReleaseDef | undefined {
  return content
    .all('release')
    .filter((r) => Date.parse(r.date) <= now)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
}

/** What the shop shows now (guidance_v2 Step 3.9): only items for sale on this app version. */
export function shopView(ctx: Pick<ShopContext, 'now' | 'clientVersion' | 'discovered'>): ShopView {
  const { now, clientVersion } = ctx;
  const order = new Map(CATALOG.map((s, i) => [s.id, i]));
  const skins = content
    .listed('animalSkin', now, clientVersion)
    .filter((s) => ctx.discovered.has(s.speciesId))
    .sort((a, b) => (order.get(a.speciesId) ?? 0) - (order.get(b.speciesId) ?? 0));
  const buildings = content.listed('building', now, clientVersion);
  const release = newestRelease(now);
  const forSale = new Set([...skins, ...content.listed('blockTheme', now, clientVersion), ...buildings].map((i) => i.id));
  return {
    featured: release ? { release, items: release.featured.filter((id) => forSale.has(id)).map((id) => content.get(id) as ItemDef) } : null,
    skins,
    themes: content.listed('blockTheme', now, clientVersion),
    buildings: BUILDING_CATEGORIES.map((category) => ({ category, items: buildings.filter((b) => b.category === category) })).filter((g) => g.items.length),
  };
}

export interface ShopFilter {
  show: 'all' | 'skins' | 'themes' | 'buildings';
  /** Species id, or '' for any. */
  species: string;
  /** Family id, `handcrafted`, or '' for any. */
  family: string;
  hideOwned: boolean;
  /** Price at most this much gold (the balance), or null for no limit. */
  maxPrice: number | null;
}

export const NO_FILTER: ShopFilter = { show: 'all', species: '', family: '', hideOwned: false, maxPrice: null };

export const isFiltered = (f: ShopFilter) => f.show !== 'all' || !!f.species || !!f.family || f.hideOwned || f.maxPrice !== null;

/**
 * Applies the shop filters (owner request) to a view: section, species and style for skins, owned
 * (skins and themes owned once are hidden; buildings never count as owned), affordability.
 */
export function filterShop(view: ShopView, f: ShopFilter, isOwned: (id: string) => boolean): ShopView {
  const keep = (i: ItemDef) => !(f.hideOwned && i.kind !== 'building' && isOwned(i.id)) && (f.maxPrice === null || (i.price ?? 0) <= f.maxPrice);
  const skins = view.skins.filter(
    (s) => keep(s) && (!f.species || s.speciesId === f.species) && (!f.family || (f.family === 'handcrafted' ? !s.family : s.family === f.family)),
  );
  return {
    featured: isFiltered(f) ? null : view.featured,
    skins: f.show === 'all' || f.show === 'skins' ? skins : [],
    themes: f.show === 'all' || f.show === 'themes' ? view.themes.filter(keep) : [],
    buildings: f.show === 'all' || f.show === 'buildings' ? view.buildings.map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length) : [],
  };
}

export interface ItemBadges {
  /** Released within `balance.shop.newBadgeDays`. */
  isNew: boolean;
  /** Limited item: time until it leaves the shop. */
  leavesInMs?: number;
}

export function itemBadges(item: ItemDef, now: number): ItemBadges {
  const release = content.get(item.release);
  const released = release?.kind === 'release' ? Date.parse(release.date) : Number.NaN;
  const out: ItemBadges = { isNew: now >= released && now - released < balance.shop.newBadgeDays * DAY };
  if (item.availableUntil) out.leavesInMs = Math.max(0, Date.parse(item.availableUntil) - now);
  return out;
}
