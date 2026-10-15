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

export const DEFAULT_EQUIPPED: Equipped = { skinBySpecies: {}, blockThemeId: DEFAULT_BLOCK_THEME };

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

export function equipSkin(equipped: Equipped, owned: readonly OwnedCosmetic[], speciesId: string, skinId: string): Equipped | EquipProblem {
  if (skinId !== DEFAULT_SKIN) {
    const item = content.get(skinId);
    if (item?.kind !== 'animalSkin') return 'wrong_kind';
    if (item.speciesId !== speciesId) return 'wrong_species';
    if (!owns(owned, skinId)) return 'not_owned';
  }
  const skinBySpecies = { ...equipped.skinBySpecies };
  if (skinId === DEFAULT_SKIN) delete skinBySpecies[speciesId];
  else skinBySpecies[speciesId] = skinId;
  return { ...equipped, skinBySpecies };
}

export function equipTheme(equipped: Equipped, owned: readonly OwnedCosmetic[], themeId: string): Equipped | EquipProblem {
  if (themeId !== DEFAULT_BLOCK_THEME) {
    if (content.get(themeId)?.kind !== 'blockTheme') return 'wrong_kind';
    if (!owns(owned, themeId)) return 'not_owned';
  }
  return { ...equipped, blockThemeId: themeId };
}

/** A stored `equipped` row cleaned against what is owned (a lost or unknown item falls back to the default). */
export function sanitizeEquipped(input: Partial<Equipped> | undefined, owned: readonly OwnedCosmetic[]): Equipped {
  let out = DEFAULT_EQUIPPED;
  for (const [speciesId, skinId] of Object.entries(input?.skinBySpecies ?? {})) {
    const next = equipSkin(out, owned, speciesId, skinId);
    if (typeof next !== 'string') out = next;
  }
  const theme = equipTheme(out, owned, input?.blockThemeId ?? DEFAULT_BLOCK_THEME);
  return typeof theme === 'string' ? out : theme;
}
