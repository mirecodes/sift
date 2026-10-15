import { describe, expect, it } from 'vitest';
import { content } from '../content';
import type { OwnedCosmetic } from '../types';
import { buyProblem, DEFAULT_EQUIPPED, equipSkin, equipTheme, grantFor, ownedCount, owns, sanitizeEquipped, unplacedBuildings } from './inventory';

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
    expect(eq).toEqual({ skinBySpecies: { fox: 'golden:fox' }, blockThemeId: 'default' });
    expect(equipSkin(eq as never, owned, 'fox', 'default')).toEqual(DEFAULT_EQUIPPED);
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'tiger', 'golden:fox')).toBe('wrong_species');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'tiger', 'white-tiger')).toBe('not_owned');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'fox', 'autumn')).toBe('wrong_kind');
    expect(equipTheme(DEFAULT_EQUIPPED, owned, 'autumn')).toMatchObject({ blockThemeId: 'autumn' });
    expect(equipTheme(DEFAULT_EQUIPPED, owned, 'snow')).toBe('not_owned');
    expect(equipTheme(DEFAULT_EQUIPPED, [], 'default')).toEqual(DEFAULT_EQUIPPED);
  });

  it('cleans a stored equipped row against the inventory', () => {
    const owned = [own('golden:fox', 'animalSkin')];
    expect(sanitizeEquipped({ skinBySpecies: { fox: 'golden:fox', tiger: 'white-tiger', cat: 'gone' }, blockThemeId: 'snow' }, owned)).toEqual({
      skinBySpecies: { fox: 'golden:fox' },
      blockThemeId: 'default',
    });
    expect(sanitizeEquipped(undefined, [])).toEqual(DEFAULT_EQUIPPED);
  });

  it('keeps items a newer pack removed from the shop usable', () => {
    content.merge({ contentVersion: '9999-01-01.1', items: content.all('species'), models: {} });
    expect(content.isRetired('golden:fox')).toBe(true);
    const owned = [own('golden:fox', 'animalSkin')];
    expect(buyProblem('golden:fox', [], ctx)).toBe('not_for_sale');
    expect(equipSkin(DEFAULT_EQUIPPED, owned, 'fox', 'golden:fox')).toEqual({ skinBySpecies: { fox: 'golden:fox' }, blockThemeId: 'default' });
  });
});
