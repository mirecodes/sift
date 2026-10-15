import { describe, expect, it } from 'vitest';
import { content } from '../content';
import type { OwnedCosmetic } from '../types';
import {
  addSkin,
  buyProblem,
  chooseSkins,
  chosenSkins,
  DEFAULT_EQUIPPED,
  equipSkin,
  equipTheme,
  grantFor,
  ownedCount,
  ownedThemes,
  owns,
  pickSpawnSkin,
  sanitizeEquipped,
  skinChoices,
  skinForAnimal,
  toggleSkin,
  unplacedBuildings,
} from './inventory';

const own = (defId: string, kind: OwnedCosmetic['kind'], i = 0): OwnedCosmetic => ({ id: `${defId}-${i}`, kind, defId, acquiredAt: 0, source: 'shop' });
const ctx = { now: Date.parse('2026-10-10'), clientVersion: '0.1.0', discovered: new Set(['tiger', 'fox']) };

describe('inventory (Step 3.7)', () => {
  it('default skin and default theme are always owned', () => {
    expect(owns([], 'default')).toBe(true);
    expect(owns([], 'golden:fox')).toBe(false);
    expect(owns([own('golden:fox', 'animalSkin')], 'golden:fox')).toBe(true);
  });

  it('counts building instances and what is left to place', () => {
    const owned = [own('lantern', 'building', 1), own('lantern', 'building', 2), own('fence', 'building'), own('cherry', 'blockTheme')];
    expect(ownedCount(owned, 'lantern')).toBe(2);
    expect([...unplacedBuildings(owned, [{ defId: 'lantern' }])]).toEqual([['lantern', 1], ['fence', 1]]);
    expect([...unplacedBuildings(owned, [{ defId: 'lantern' }, { defId: 'lantern' }, { defId: 'fence' }])]).toEqual([]);
  });

  it('sells skins and themes once, buildings any number of times', () => {
    expect(buyProblem('golden:fox', [], ctx)).toBeNull();
    expect(buyProblem('golden:fox', [own('golden:fox', 'animalSkin')], ctx)).toBe('owned');
    expect(buyProblem('cherry', [own('cherry', 'blockTheme')], ctx)).toBe('owned');
    expect(buyProblem('lantern', [own('lantern', 'building')], ctx)).toBeNull();
  });

  it('refuses unknown, free, unavailable items and skins of species not found yet', () => {
    expect(buyProblem('dragon-hat', [], ctx)).toBe('unknown');
    expect(buyProblem('tiger', [], ctx)).toBe('unknown');
    expect(buyProblem('default', [], ctx)).toBe('not_for_sale');
    expect(buyProblem('champion-flag', [], ctx)).toBe('not_for_sale');
    expect(buyProblem('golden:panda', [], ctx)).toBe('species_not_found');
  });

  it('grants one inventory row per purchase', () => {
    const lantern = content.get('lantern');
    expect(lantern?.kind).toBe('building');
    expect(grantFor(lantern as never, 'id1', 5)).toEqual({ id: 'id1', kind: 'building', defId: 'lantern', acquiredAt: 5, source: 'shop' });
  });

  it('equips owned skins per species and themes; default always works', () => {
    const owned = [own('golden:fox', 'animalSkin'), own('autumn', 'blockTheme')];
    const eq = equipSkin(DEFAULT_EQUIPPED, owned, 'fox', 'golden:fox');
    expect(eq).toEqual({ skinsBySpecies: { fox: ['golden:fox'] }, blockThemeId: 'default' });
    expect(equipSkin(eq as never, owned, 'fox', 'default')).toEqual(DEFAULT_EQUIPPED);
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'tiger', 'golden:fox')).toBe('wrong_species');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'tiger', 'white-tiger')).toBe('not_owned');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'fox', 'autumn')).toBe('wrong_kind');
    expect(equipTheme(DEFAULT_EQUIPPED, owned, 'autumn')).toMatchObject({ blockThemeId: 'autumn' });
    expect(equipTheme(DEFAULT_EQUIPPED, owned, 'snow')).toBe('not_owned');
    expect(equipTheme(DEFAULT_EQUIPPED, [], 'default')).toEqual(DEFAULT_EQUIPPED);
  });

  it('cleans a stored equipped row against the inventory, reading the old one-skin rows too', () => {
    const owned = [own('golden:fox', 'animalSkin')];
    expect(sanitizeEquipped({ skinBySpecies: { fox: 'golden:fox', tiger: 'white-tiger', cat: 'gone' }, blockThemeId: 'snow' }, owned)).toEqual({
      skinsBySpecies: { fox: ['golden:fox'] },
      blockThemeId: 'default',
    });
    expect(sanitizeEquipped({ skinsBySpecies: { fox: ['golden:fox', 'snowy:fox', 'default'] }, blockThemeId: 'default' }, owned)).toEqual({
      skinsBySpecies: { fox: ['golden:fox', 'default'] },
      blockThemeId: 'default',
    });
    expect(sanitizeEquipped(undefined, [])).toEqual(DEFAULT_EQUIPPED);
  });

  it('chooses several skins per species, toggles, adds and picks one per animal (ADR-043)', () => {
    const owned = [own('golden:fox', 'animalSkin'), own('ghost:fox', 'animalSkin')];
    let eq = toggleSkin(DEFAULT_EQUIPPED, owned, 'fox', 'golden:fox') as never as typeof DEFAULT_EQUIPPED;
    expect(chosenSkins(eq, 'fox')).toEqual(['default', 'golden:fox']);
    eq = toggleSkin(eq, owned, 'fox', 'default') as never;
    expect(chosenSkins(eq, 'fox')).toEqual(['golden:fox']);
    expect(toggleSkin(eq, owned, 'fox', 'golden:fox')).toBe(eq); // the last one stays
    expect(chosenSkins(addSkin(DEFAULT_EQUIPPED, owned, 'fox', 'ghost:fox') as never, 'fox')).toEqual(['ghost:fox']); // Default alone is replaced
    eq = chooseSkins(eq, owned, 'fox', ['golden:fox', 'ghost:fox', 'default']) as never;
    expect(chooseSkins(eq, owned, 'fox', ['snowy:fox'])).toBe('not_owned');
    // Spawn: a random pick among the chosen; draw: the arrival skin while it stays chosen, else a fixed pick.
    expect(pickSpawnSkin(eq, 'fox', () => 0.99)).toBe('default');
    expect(pickSpawnSkin(eq, 'fox', () => 0)).toBe('golden:fox');
    expect(skinForAnimal({ id: 'a', speciesId: 'fox', skinId: 'ghost:fox' }, eq)).toBe('ghost:fox');
    const narrowed = chooseSkins(eq, owned, 'fox', ['golden:fox']) as never as typeof eq;
    expect(skinForAnimal({ id: 'a', speciesId: 'fox', skinId: 'ghost:fox' }, narrowed)).toBe('golden:fox');
    const picks = new Set(Array.from({ length: 40 }, (_, i) => skinForAnimal({ id: `x${i}`, speciesId: 'fox' }, eq)));
    expect(picks).toEqual(new Set(['golden:fox', 'ghost:fox', 'default']));
    expect(skinForAnimal({ id: 'x1', speciesId: 'fox' }, eq)).toBe(skinForAnimal({ id: 'x1', speciesId: 'fox' }, eq));
    expect(skinForAnimal({ id: 'x1', speciesId: 'cat' }, eq)).toBe('default');
  });

  it('lists skin choices for a species: default, owned, then for sale (Step 3.10)', () => {
    const owned = [own('white-tiger', 'animalSkin')];
    const choices = skinChoices('tiger', owned, ctx.now, ctx.clientVersion);
    expect(choices[0]).toEqual({ id: 'default', owned: true });
    expect(choices.find((c) => c.id === 'white-tiger')).toEqual({ id: 'white-tiger', owned: true });
    expect(choices.find((c) => c.id === 'golden:tiger')).toEqual({ id: 'golden:tiger', owned: false, price: 60 });
    expect(choices).toHaveLength(7);
    expect(skinChoices('fox', [], ctx.now, ctx.clientVersion).every((c) => c.id === 'default' || c.id.endsWith(':fox'))).toBe(true);
  });

  it('lists owned themes, Default first', () => {
    expect(ownedThemes([])).toEqual(['default']);
    expect(ownedThemes([own('cherry', 'blockTheme'), own('autumn', 'blockTheme')])).toEqual(['default', 'autumn', 'cherry']);
  });

  it('keeps items a newer pack removed from the shop usable', () => {
    content.merge({ contentVersion: '9999-01-01.1', items: content.all('species'), models: {} });
    expect(content.isRetired('golden:fox')).toBe(true);
    const owned = [own('golden:fox', 'animalSkin')];
    expect(buyProblem('golden:fox', [], ctx)).toBe('not_for_sale');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'fox', 'golden:fox')).toEqual({ skinsBySpecies: { fox: ['golden:fox'] }, blockThemeId: 'default' });
  });
});
