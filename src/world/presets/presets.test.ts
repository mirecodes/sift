import { readFileSync } from 'node:fs';
import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PRESET_IDS } from './index';
import { PART_PRESETS } from './parts';
import { FIELD_PRESETS, particleAt } from './particles';

const listed = JSON.parse(readFileSync(new URL('../../../content/presets.json', import.meta.url), 'utf8')) as Record<string, string[]>;

describe('behavior presets (Step 3.2)', () => {
  it('content/presets.json lists exactly the presets the code implements', () => {
    for (const kind of ['idle', 'part', 'particles', 'light'] as const) {
      expect([...PRESET_IDS[kind]].sort(), kind).toEqual([...(listed[kind] ?? [])].sort());
    }
  });

  it('part presets animate over time and stay bounded', () => {
    const at = (id: string, t: number) => {
      const o = new Object3D();
      o.userData.baseY = 1;
      PART_PRESETS[id]!(o, t, 0);
      return o;
    };
    expect(at('spin', 0).rotation.z).toBe(0);
    expect(at('spin', 1).rotation.z).toBeCloseTo(Math.PI / 2);
    for (const t of [0.3, 0.9, 1.7]) {
      expect(Math.abs(at('sway', t).rotation.z)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(at('bob', t).position.y - 1)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(at('flap', t).rotation.x)).toBeLessThanOrEqual(0.5);
    }
    expect(at('sway', 0.3).rotation.z).not.toBe(at('sway', 0.9).rotation.z);
  });

  it('particles are deterministic, fade in and out and drift with their velocity', () => {
    const area = [6, 3, 6] as const;
    const snow = FIELD_PRESETS.snow;
    expect(particleAt(snow, area, 3, 2.5)).toEqual(particleAt(snow, area, 3, 2.5));
    for (let i = 0; i < snow.count; i++) {
      for (const t of [0, 1.3, 5.2, 40]) {
        const p = particleAt(snow, area, i, t);
        expect(p.s).toBeGreaterThanOrEqual(0);
        expect(p.s).toBeLessThanOrEqual(snow.size);
        expect(p.y).toBeLessThanOrEqual(area[1]);
        expect(Math.abs(p.x)).toBeLessThan(area[0] / 2 + 1);
      }
    }
    // Snow falls: a moment later nearly every flake is lower (a few respawn at the top).
    let lower = 0;
    for (let i = 0; i < snow.count; i++) if (particleAt(snow, area, i, 10.1).y < particleAt(snow, area, i, 10).y) lower++;
    expect(lower).toBeGreaterThanOrEqual(snow.count - 3);
  });
});
