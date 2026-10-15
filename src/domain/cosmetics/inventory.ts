import type { ItemDef } from '../../../shared/content/schema';
import { DEFAULT_BLOCK_THEME } from '../config';
import { content } from '../content';
import { isAvailable } from '../content/registry';
import { DEFAULT_SKIN } from '../island/model';
import type { Equipped, OwnedCosmetic, PlacedBuilding } from '../types';

/**
 * Inventory and equip rules (guidance_v2 Step 3.7). Owned items live in the `cosmetics` store, one
 * row per instance: skins and themes once, buildings any number of times. The default skin and the
 * default theme are always owned. Owned items stay usable even after a newer pack drops them from
 * the shop: the registry keeps every item it ever knew.
 */

export const DEFAULT_EQUIPPED: Equipped = { skinsBySpecies: {}, blockThemeId: DEFAULT_BLOCK_THEME };

export const isDefaultItem = (defId: string) => defId === DEFAULT_SKIN || defId === DEFAULT_BLOCK_THEME;

export const ownedCount = (owned: readonly OwnedCosmetic[], defId: string): number => owned.filter((c) => c.defId === defId).length;

export const owns = (owned: readonly OwnedCosmetic[], defId: string): boolean => isDefaultItem(defId) || ownedCount(owned, defId) > 0;

/** Owned building instances not placed on the island, by definition id (the build-mode tray). */
export function unplacedBuildings(owned: readonly OwnedCosmetic[], placed: readonly Pick<PlacedBuilding, 'defId'>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of owned) if (c.kind === 'building') out.set(c.defId, (out.get(c.defId) ?? 0) + 1);
  for (const p of placed) out.set(p.defId, (out.get(p.defId) ?? 0) - 1);
  for (const [id, n] of out) if (n <= 0) out.delete(id);
  return out;
}

export type BuyProblem = 'unknown' | 'not_for_sale' | 'owned' | 'species_not_found';

export interface ShopContext {
  now: number;
  clientVersion: string;
  /** Species the user has earned at least once: skins of other species are not sold to them. */
  discovered: ReadonlySet<string>;
}

/** Why an item cannot be bought now, or null. Gold is checked by `spendGold`. */
export function buyProblem(defId: string, owned: readonly OwnedCosmetic[], ctx: ShopContext): BuyProblem | null {
  const item = content.get(defId);
  if (!item || (item.kind !== 'animalSkin' && item.kind !== 'blockTheme' && item.kind !== 'building')) return 'unknown';
  if (!item.purchasable || item.price === undefined || content.isRetired(defId) || !isAvailable(item, ctx.now, ctx.clientVersion)) return 'not_for_sale';
  if (item.kind !== 'building' && owns(owned, defId)) return 'owned';
  if (item.kind === 'animalSkin' && !ctx.discovered.has(item.speciesId)) return 'species_not_found';
  return null;
}

/** The inventory row a purchase writes, in the same transaction as the debit. */
export function grantFor(item: ItemDef, id: string, now: number): OwnedCosmetic {
  return { id, kind: item.kind, defId: item.id, acquiredAt: now, source: 'shop' };
}

export type EquipProblem = 'not_owned' | 'wrong_kind' | 'wrong_species';

function skinProblem(owned: readonly OwnedCosmetic[], speciesId: string, skinId: string): EquipProblem | null {
  if (skinId === DEFAULT_SKIN) return null;
  const item = content.get(skinId);
  if (item?.kind !== 'animalSkin') return 'wrong_kind';
  if (item.speciesId !== speciesId) return 'wrong_species';
  return owns(owned, skinId) ? null : 'not_owned';
}

/** The skins chosen for a species (ADR-043); Default alone when none are. */
export const chosenSkins = (equipped: Equipped, speciesId: string): readonly string[] => {
  const list = equipped.skinsBySpecies[speciesId];
  return list?.length ? list : [DEFAULT_SKIN];
};

/**
 * Sets the chosen skins of a species: one or more, each owned and of that species. An empty list or
 * Default alone clears the choice.
 */
export function chooseSkins(equipped: Equipped, owned: readonly OwnedCosmetic[], speciesId: string, skinIds: readonly string[]): Equipped | EquipProblem {
  const list = [...new Set(skinIds)];
  for (const id of list) {
    const problem = skinProblem(owned, speciesId, id);
    if (problem) return problem;
  }
  const skinsBySpecies = { ...equipped.skinsBySpecies };
  if (!list.length || (list.length === 1 && list[0] === DEFAULT_SKIN)) delete skinsBySpecies[speciesId];
  else skinsBySpecies[speciesId] = list;
  return { ...equipped, skinsBySpecies };
}

/** Wear only this skin. */
export const equipSkin = (equipped: Equipped, owned: readonly OwnedCosmetic[], speciesId: string, skinId: string) => chooseSkins(equipped, owned, speciesId, [skinId]);

/** Adds a skin to the choice; a choice of Default alone is replaced (a new purchase shows at once). */
export function addSkin(equipped: Equipped, owned: readonly OwnedCosmetic[], speciesId: string, skinId: string): Equipped | EquipProblem {
  const current = chosenSkins(equipped, speciesId);
  const base = current.length === 1 && current[0] === DEFAULT_SKIN ? [] : current;
  return chooseSkins(equipped, owned, speciesId, [...base, skinId]);
}

/** Turns one skin on or off in the choice; the last chosen skin stays on. */
export function toggleSkin(equipped: Equipped, owned: readonly OwnedCosmetic[], speciesId: string, skinId: string): Equipped | EquipProblem {
  const current = chosenSkins(equipped, speciesId);
  if (!current.includes(skinId)) return chooseSkins(equipped, owned, speciesId, [...current, skinId]);
  if (current.length === 1) return equipped;
  return chooseSkins(equipped, owned, speciesId, current.filter((id) => id !== skinId));
}

const hashId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h >>> 0;
};

/** The skin a new animal gets: one of its species' chosen skins, at random. */
export function pickSpawnSkin(equipped: Equipped, speciesId: string, rng: () => number): string {
  const chosen = chosenSkins(equipped, speciesId);
  return chosen[Math.min(chosen.length - 1, Math.floor(rng() * chosen.length))]!;
}

/**
 * The skin an animal wears: the one it got on arrival while that skin is still chosen; otherwise a
 * fixed pick among the chosen skins (by its id), so it never flickers between frames or reloads.
 */
export function skinForAnimal(animal: { id: string; speciesId: string; skinId?: string }, equipped: Equipped): string {
  const chosen = chosenSkins(equipped, animal.speciesId);
  if (animal.skinId && chosen.includes(animal.skinId)) return animal.skinId;
  return chosen[hashId(animal.id) % chosen.length]!;
}

export function equipTheme(equipped: Equipped, owned: readonly OwnedCosmetic[], themeId: string): Equipped | EquipProblem {
  if (themeId !== DEFAULT_BLOCK_THEME) {
    if (content.get(themeId)?.kind !== 'blockTheme') return 'wrong_kind';
    if (!owns(owned, themeId)) return 'not_owned';
  }
  return { ...equipped, blockThemeId: themeId };
}

export interface SkinChoice {
  /** Skin id, or `default`. */
  id: string;
  owned: boolean;
  /** Price when it can be bought now (not owned, for sale). */
  price?: number;
}

/**
 * The Collection's species sheet (Step 3.10): Default first, then every skin of the species that is
 * owned or for sale now, in content order. Skins neither owned nor for sale are left out.
 */
export function skinChoices(speciesId: string, owned: readonly OwnedCosmetic[], now: number, clientVersion: string): SkinChoice[] {
  const forSale = new Set(content.listed('animalSkin', now, clientVersion).map((s) => s.id));
  const skins = content
    .all('animalSkin')
    .filter((s) => s.speciesId === speciesId && (owns(owned, s.id) || forSale.has(s.id)))
    .map((s): SkinChoice => (owns(owned, s.id) ? { id: s.id, owned: true } : { id: s.id, owned: false, price: s.price! }));
  return [{ id: DEFAULT_SKIN, owned: true }, ...skins];
}

/** Themes the island can wear: Default, then owned themes in content order. */
export function ownedThemes(owned: readonly OwnedCosmetic[]): string[] {
  return content.all('blockTheme').filter((t) => owns(owned, t.id)).map((t) => t.id);
}

/**
 * A stored `equipped` row cleaned against what is owned: lost or unknown skins drop out of a choice
 * (an emptied choice falls back to Default), an unowned theme falls back to the default. Rows from
 * before ADR-043 (`skinBySpecies`, one skin each) are read as a choice of one.
 */
export function sanitizeEquipped(input: (Partial<Equipped> & { skinBySpecies?: Record<string, string> }) | undefined, owned: readonly OwnedCosmetic[]): Equipped {
  let out = DEFAULT_EQUIPPED;
  const lists: Record<string, string[]> = { ...Object.fromEntries(Object.entries(input?.skinBySpecies ?? {}).map(([s, id]) => [s, [id]])), ...input?.skinsBySpecies };
  for (const [speciesId, ids] of Object.entries(lists)) {
    const next = chooseSkins(out, owned, speciesId, (Array.isArray(ids) ? ids : []).filter((id) => !skinProblem(owned, speciesId, id)));
    if (typeof next !== 'string') out = next;
  }
  const theme = equipTheme(out, owned, input?.blockThemeId ?? DEFAULT_BLOCK_THEME);
  return typeof theme === 'string' ? out : theme;
}
