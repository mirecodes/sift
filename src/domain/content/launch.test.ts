import { describe, expect, it } from 'vitest';
import type { BuildingDef } from '../../../shared/content/schema';
import { content } from './index';

describe('initial content set, release v2-launch (Step 3.6)', () => {
  it('has the five block themes, Default free', () => {
    const themes = content.all('blockTheme').filter((t) => t.release !== 'themes-oct-2026');
    expect(themes.map((t) => t.id).sort()).toEqual(['autumn', 'cherry', 'default', 'desert', 'snow']);
    expect(themes.find((t) => t.id === 'default')).toMatchObject({ purchasable: false });
  });

  it('adds Winter and Future City in their own release (owner request)', () => {
    expect(content.get('winter')).toMatchObject({ kind: 'blockTheme', ambient: 'snow', release: 'themes-oct-2026' });
    expect(content.get('future')).toMatchObject({ kind: 'blockTheme', finish: 'glossy', ambient: 'glints' });
    expect((content.get('future') as { tileTints: string[] }).tileTints.length).toBeGreaterThan(5);
    expect(content.listed('blockTheme', Date.parse('2026-10-10'), '0.1.0')).toHaveLength(6);
  });

  it('has the nine buildings with their presets and rules', () => {
    const b = (id: string) => content.get(id) as BuildingDef;
    expect(content.all('building').map((x) => x.id).sort()).toEqual(
      ['champion-flag', 'fence', 'flower-bed', 'footbridge', 'lantern', 'small-tree', 'stone-statue', 'well', 'windmill'],
    );
    expect(b('windmill').parts).toEqual([{ name: 'blade', preset: 'spin' }]);
    expect(b('windmill').price).toBe(80);
    expect(b('fence').price).toBe(10);
    expect(b('footbridge').allowOnWater).toBe(true);
    expect(b('lantern').light).toBe('lantern_glow');
    expect(b('champion-flag').purchasable).toBe(false);
    expect(content.model('buildings/windmill')?.parts?.blade).toBeDefined();
  });

  it('has five skin families over all 50 species plus two handcrafted skins', () => {
    const skins = content.all('animalSkin');
    for (const f of ['golden', 'snowy', 'shadow', 'pastel', 'ghost']) expect(skins.filter((s) => s.family === f)).toHaveLength(50);
    expect(content.get('white-tiger')).toMatchObject({ speciesId: 'tiger', price: 80 });
    expect(content.get('night-unicorn')).toMatchObject({ speciesId: 'unicorn', price: 80 });
    expect(content.get('golden:tiger')).toMatchObject({ price: 60, release: 'v2-launch' });
  });

  it('every new item ships in v2-launch, which features some of them', () => {
    const release = content.get('v2-launch');
    expect(release).toMatchObject({ kind: 'release', date: '2026-10-08' });
    for (const kind of ['animalSkin', 'building'] as const) for (const i of content.all(kind)) expect(i.release).toBe('v2-launch');
    for (const id of (release as { featured: string[] }).featured) expect(content.get(id)).toBeDefined();
  });
});
