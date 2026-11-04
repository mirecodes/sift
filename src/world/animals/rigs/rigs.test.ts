import { describe, expect, it } from 'vitest';
import type { TierRank } from '../../../domain/config';
import { CATALOG } from '../../../domain/animals/catalog';
import { animalRigGeometry } from '../../voxel/geometry';
import { createRig, RIGS, type RigFrame } from './index';
import { envelope } from './AnimalRig';

const frame = (over: Partial<RigFrame> = {}): RigFrame => ({ t: 0, stride: 0, walk: 0, hop: 0, lie: 0, excited: false, ...over });
const rigFor = (id: string, rank?: TierRank) => {
  const species = CATALOG.find((s) => s.id === id)!;
  const geo = animalRigGeometry(species.modelId);
  return createRig(species.rig, geo.bones, rank ?? species.tierRank)!;
};
const angles = (rig: ReturnType<typeof rigFor>) => rig.bones.flatMap((b) => [b.rotation.x, b.rotation.y, b.rotation.z, b.position.x, b.position.y, b.position.z]);

describe('animal rigs (ADR-055)', () => {
  it('gives every species with a rig a known rig class and at least one motion or a living idle', () => {
    for (const s of CATALOG) {
      if (!s.rig) continue;
      expect(Object.keys(RIGS), s.id).toContain(s.rig);
      const rig = rigFor(s.id);
      expect(rig.bones.length, s.id).toBeGreaterThan(1);
    }
  });

  it('builds one bone per part, parents first (ears ride on the head)', () => {
    const geo = animalRigGeometry('animals/dog');
    const names = geo.bones.map((b) => b.name);
    expect(names).toContain('head');
    const ear = geo.bones.find((b) => b.name === 'earL')!;
    expect(geo.bones[ear.parent]?.name).toBe('head');
    expect(names.indexOf('head')).toBeLessThan(names.indexOf('earL'));
    const tail2 = geo.bones.find((b) => b.name === 'tail2');
    if (tail2) expect(geo.bones[tail2.parent]?.name).toBe('tail');
    // Every vertex follows one existing bone.
    const index = geo.geometry.getAttribute('skinIndex');
    for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThanOrEqual(geo.bones.length);
  });

  it('knows more motions at higher tiers', () => {
    for (const id of ['tiger', 'unicorn', 'wolf', 'peacock']) {
      const counts = ([0, 1, 2, 3] as const).map((r) => rigFor(id, r).motions.length);
      for (let r = 1; r < 4; r++) expect(counts[r], `${id} rank ${r}`).toBeGreaterThanOrEqual(counts[r - 1]!);
      expect(counts[3], id).toBeGreaterThan(counts[0]!);
    }
    expect(rigFor('tiger').motions.map((m) => m.id)).toEqual(expect.arrayContaining(['roar', 'pounce', 'groom', 'sit']));
    expect(rigFor('unicorn').motions.map((m) => m.id)).toContain('rear');
    expect(rigFor('dog').motions.map((m) => m.id)).not.toContain('howl'); // Mythic: not yet
    expect(rigFor('wolf').motions.map((m) => m.id)).toContain('howl');
  });

  it('skips motions whose parts the model lacks', () => {
    for (const s of CATALOG) {
      if (!s.rig) continue;
      const rig = rigFor(s.id);
      for (const m of rig.motions) for (const n of m.needs) expect(rig.has(n), `${s.id} ${m.id} needs ${n}`).toBe(true);
    }
  });

  it('plays a motion, moves bones, and returns to rest when it ends', () => {
    const rig = rigFor('dog');
    rig.update(frame({ t: 0 }));
    const rest = angles(rig);
    const length = rig.playById('wag', 0);
    expect(length).toBeGreaterThan(0);
    rig.update(frame({ t: length * 0.4 }));
    expect(angles(rig)).not.toEqual(rest);
    rig.update(frame({ t: length + 0.01 }));
    expect(rig.playing).toBeNull();
  });

  it('swings the legs while walking and stays at rest with reduced motion', () => {
    const rig = rigFor('horse');
    rig.update(frame({ walk: 1, stride: Math.PI / 2 }));
    const leg = rig.bones.find((b) => b.name === 'legFL')!;
    expect(Math.abs(leg.rotation.x)).toBeGreaterThan(0.2);
    rig.still();
    expect(leg.rotation.x).toBe(0);
  });

  it('flaps butterfly wings all the time and holds them half open with reduced motion', () => {
    const rig = rigFor('butterfly');
    const wing = rig.bones.find((b) => b.name === 'wingL')!;
    const seen = new Set<number>();
    for (let t = 0; t < 1; t += 0.05) {
      rig.update(frame({ t }));
      seen.add(Math.round(wing.rotation.z * 100));
    }
    expect(seen.size).toBeGreaterThan(5);
    rig.still();
    expect(wing.rotation.z).toBeCloseTo(-0.3);
  });

  it('does not repeat the same motion twice in a row when it knows several', () => {
    const rig = rigFor('tiger');
    let last = '';
    for (let i = 0; i < 20; i++) {
      rig.play(i * 10);
      expect(rig.playing).not.toBe(last);
      last = rig.playing!;
    }
  });

  it('eases motions in and out', () => {
    expect(envelope(0)).toBe(0);
    expect(envelope(0.5)).toBe(1);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.1)).toBeGreaterThan(0);
    expect(envelope(0.1)).toBeLessThan(1);
  });

  it('returns null for a species without a rig or an unknown id', () => {
    expect(createRig(undefined, [], 0)).toBeNull();
    expect(createRig('no_such_rig', [], 0)).toBeNull();
  });
});
