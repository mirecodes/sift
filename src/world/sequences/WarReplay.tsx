import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, Color, MeshBasicMaterial, MeshLambertMaterial, Object3D, type Group, type InstancedMesh } from 'three';
import type { WarView } from '../../../shared/api/types';
import { getSpecies } from '../../domain/animals/catalog';
import { config } from '../../domain/config';
import { generateIsland, islandSide } from '../../domain/island/island';
import { animalGeometry } from '../voxel/geometry';
import { hash01, planWar, poseAt, SHIP_SCALE, shipAt, type Effect, type EffectKind, type FighterPlan, type Vec2, type WarPlan } from './warTimeline';

const box = new BoxGeometry(1, 1, 1);
const lambert = (color: string) => new MeshLambertMaterial({ color, flatShading: true });
const M = {
  hull: lambert('#8A5A34'),
  hullDark: lambert('#5E3B22'),
  deck: lambert('#C08A55'),
  trim: lambert('#D9A93A'),
  iron: lambert('#3A3A40'),
  mast: lambert('#6E4527'),
  sail: lambert('#F4EBDD'),
  sailShade: lambert('#E4D8C4'),
  red: lambert('#D8483F'),
  redDark: lambert('#A8322C'),
  glow: new MeshBasicMaterial({ color: '#FFD978' }),
};
const base = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Shared with the screen: playback speed (1 or 2) and Skip. */
export interface WarReplayRefs {
  speed: MutableRefObject<number>;
  skip: MutableRefObject<boolean>;
  /** Seconds into the replay (read by the screen for its result panel). */
  time: MutableRefObject<number>;
}

type Part = { m: MeshLambertMaterial | MeshBasicMaterial; s: [number, number, number]; p: [number, number, number]; r?: [number, number, number] };

/** One square sail, billowed forward (+x) in three slices, with an optional red band. */
function sail(x: number, y: number, width: number, height: number, band: boolean): Part[] {
  const slices = [-1, 0, 1];
  return slices.flatMap((i) => {
    const bulge = i === 0 ? 0.14 : 0.06;
    const z = (i * width) / 3;
    const parts: Part[] = [{ m: i === 0 ? M.sail : M.sailShade, s: [0.05, height, width / 3 + 0.01], p: [x + bulge, y, z] }];
    if (band) parts.push({ m: M.red, s: [0.06, height * 0.18, width / 3 + 0.02], p: [x + bulge + 0.005, y - height * 0.22, z] });
    return parts;
  });
}

/** The ship's fixed parts, in its own space: bow at +x, deck at `DECK_Y`. */
const SHIP: Part[] = (() => {
  const p: Part[] = [
    // Hull: stepped layers, narrower below, rising toward bow and stern.
    { m: M.hullDark, s: [3.4, 0.28, 0.7], p: [0, -0.52, 0] },
    { m: M.hull, s: [4.3, 0.34, 1.2], p: [0.05, -0.22, 0] },
    { m: M.hull, s: [4.8, 0.42, 1.6], p: [0, 0.15, 0] },
    { m: M.hull, s: [0.55, 0.42, 1.1], p: [2.65, 0.2, 0] },
    { m: M.hull, s: [0.4, 0.38, 0.6], p: [3.05, 0.32, 0] },
    { m: M.hullDark, s: [4.86, 0.06, 1.63], p: [0, 0.02, 0] },
    { m: M.trim, s: [4.88, 0.05, 1.65], p: [0, 0.36, 0] },
    { m: M.deck, s: [4.6, 0.06, 1.46], p: [0, 0.4, 0] },
    // Stern castle with lit windows and a lantern.
    { m: M.hull, s: [1.25, 0.55, 1.62], p: [-1.95, 0.66, 0] },
    { m: M.trim, s: [1.27, 0.05, 1.64], p: [-1.95, 0.95, 0] },
    { m: M.deck, s: [1.2, 0.05, 1.5], p: [-1.95, 0.97, 0] },
    { m: M.glow, s: [0.04, 0.14, 0.18], p: [-2.59, 0.62, -0.4] },
    { m: M.glow, s: [0.04, 0.14, 0.18], p: [-2.59, 0.62, 0] },
    { m: M.glow, s: [0.04, 0.14, 0.18], p: [-2.59, 0.62, 0.4] },
    { m: M.iron, s: [0.05, 0.4, 0.05], p: [-2.55, 1.15, 0] },
    { m: M.glow, s: [0.14, 0.16, 0.14], p: [-2.55, 1.42, 0] },
    // Bowsprit.
    { m: M.mast, s: [1.5, 0.07, 0.07], p: [3.55, 0.72, 0], r: [0, 0, 0.32] },
    // Masts and yards.
    { m: M.mast, s: [0.13, 3.1, 0.13], p: [0.35, 1.95, 0] },
    { m: M.mast, s: [0.12, 2.5, 0.12], p: [1.8, 1.65, 0] },
    { m: M.mast, s: [0.1, 1.8, 0.1], p: [-1.6, 1.85, 0] },
    { m: M.mast, s: [0.07, 0.07, 1.9], p: [0.35, 2.7, 0] },
    { m: M.mast, s: [0.07, 0.07, 1.6], p: [0.35, 1.25, 0] },
    { m: M.mast, s: [0.06, 0.06, 1.5], p: [1.8, 2.35, 0] },
    { m: M.mast, s: [0.06, 0.06, 1.3], p: [1.8, 1.1, 0] },
    // Crow's nest.
    { m: M.hullDark, s: [0.36, 0.14, 0.36], p: [0.35, 3.05, 0] },
  ];
  // Railings: posts and a rail on both sides.
  for (const z of [-0.76, 0.76]) {
    for (let x = -1.2; x <= 2.4; x += 0.4) p.push({ m: M.hullDark, s: [0.05, 0.18, 0.05], p: [x, 0.52, z] });
    p.push({ m: M.trim, s: [3.7, 0.04, 0.05], p: [0.6, 0.62, z] });
    // Gun ports with barrels.
    for (const x of [-0.9, 0, 0.9, 1.8]) {
      p.push({ m: M.iron, s: [0.18, 0.13, 0.04], p: [x, 0.12, z * 1.06] });
      p.push({ m: M.iron, s: [0.08, 0.08, 0.16], p: [x, 0.12, z * 1.12] });
    }
  }
  // Sails: main course (with the band and a paw), main topsail, fore course and topsail, mizzen.
  p.push(...sail(0.42, 1.95, 1.6, 1.15, true), ...sail(0.42, 3.05 - 0.4, 1.3, 0.75, false));
  p.push(...sail(1.86, 1.7, 1.35, 1.0, true), ...sail(1.86, 2.55 - 0.25, 1.1, 0.55, false));
  p.push(...sail(-1.54, 1.95, 1.0, 0.95, false));
  const pawX = 0.42 + 0.16;
  p.push({ m: M.redDark, s: [0.04, 0.26, 0.3], p: [pawX, 2.1, 0] });
  for (const [dy, dz] of [[0.25, -0.18], [0.31, 0], [0.25, 0.18]] as const) p.push({ m: M.redDark, s: [0.04, 0.1, 0.1], p: [pawX, 2.1 + dy, dz] });
  return p;
})();

/** The flying wooden ship (DESIGN.md 15.9): hull, castle, three masts with billowed sails, flags. */
function Ship({ shipRef, at }: { shipRef: MutableRefObject<Group | null>; at: MutableRefObject<number> }) {
  const sails = useRef<Group>(null);
  const pennant = useRef<Group>(null);
  useFrame(() => {
    const t = at.current;
    if (sails.current) sails.current.scale.x = 1 + Math.sin(t * 2.2) * 0.06;
    if (pennant.current) pennant.current.rotation.y = Math.sin(t * 6) * 0.35;
  });
  return (
    <group ref={shipRef} scale={SHIP_SCALE}>
      {SHIP.filter((x) => x.m !== M.sail && x.m !== M.sailShade && x.m !== M.red && x.m !== M.redDark).map((x, i) => (
        <mesh key={i} geometry={box} material={x.m} scale={x.s} position={x.p} {...(x.r && { rotation: x.r })} />
      ))}
      <group ref={sails}>
        {SHIP.filter((x) => x.m === M.sail || x.m === M.sailShade || x.m === M.red || x.m === M.redDark).map((x, i) => (
          <mesh key={i} geometry={box} material={x.m} scale={x.s} position={x.p} />
        ))}
      </group>
      {/* A long pennant on the main mast and a flag at the stern. */}
      <group ref={pennant} position={[0.35, 3.55, 0]}>
        <mesh geometry={box} material={M.red} scale={[0.9, 0.16, 0.03]} position={[-0.45, 0, 0]} />
        <mesh geometry={box} material={M.redDark} scale={[0.35, 0.1, 0.03]} position={[-1.05, 0, 0]} />
      </group>
      <mesh geometry={box} material={M.mast} scale={[0.04, 0.7, 0.04]} position={[-2.35, 1.3, 0]} />
      <mesh geometry={box} material={M.red} scale={[0.45, 0.28, 0.03]} position={[-2.6, 1.5, 0]} />
    </group>
  );
}

const dummy = new Object3D();
const white = new Color('#FFFFFF');
const hurt = new Color('#FF6A5C');
const tint = new Color();

/**
 * All fighters of one species and skin in one instanced mesh (Step 9.9: up to 2 × 100 animals in a few
 * draw calls). Hits flash red through the instance color; fading out is drawn as shrinking.
 */
function FighterKind({ plan, fighters, at }: { plan: WarPlan; fighters: FighterPlan[]; at: MutableRefObject<number> }) {
  const mesh = useRef<InstancedMesh>(null);
  const f0 = fighters[0]!;
  const geometry = useMemo(() => animalGeometry(getSpecies(f0.speciesId).modelId, f0.skinId), [f0.speciesId, f0.skinId]);
  const s = config.render.animalScale;
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    fighters.forEach((f, i) => {
      const p = poseAt(plan, f, at.current);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.tilt, p.yaw, 0, 'YXZ');
      const k = p.scale < 0.01 ? 0 : s * p.scale;
      dummy.scale.set(k * p.squash, k / p.squash, k * p.squash);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tint.copy(white).lerp(hurt, p.flash));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, base, fighters.length]} frustumCulled={false} />;
}

/** Particles per effect: count, life (s), colors, speed, size, gravity, rise. */
const KINDS: Record<EffectKind, { n: number; life: number; colors: string[]; speed: number; size: number; gravity: number; rise: number }> = {
  hit: { n: 6, life: 0.32, colors: ['#FFFFFF', '#FFE27A', '#FFB347'], speed: 1.6, size: 0.06, gravity: 3, rise: 0.6 },
  blow: { n: 11, life: 0.45, colors: ['#FFFFFF', '#FFD24D', '#FF8A3D'], speed: 2.4, size: 0.08, gravity: 4, rise: 1 },
  poof: { n: 14, life: 0.75, colors: ['#F2F2F2', '#D9D9E0', '#BFC3CC', '#FFE27A'], speed: 0.9, size: 0.13, gravity: -0.6, rise: 0.3 },
  down: { n: 7, life: 0.5, colors: ['#D9C3A0', '#BFA57F'], speed: 0.9, size: 0.07, gravity: 1, rise: 0.15 },
  land: { n: 6, life: 0.4, colors: ['#E6D5B8', '#CDB894'], speed: 1, size: 0.06, gravity: 1.5, rise: 0.25 },
  shield: { n: 9, life: 0.9, colors: ['#FFE98A', '#FFF6C9', '#FFD24D'], speed: 0.5, size: 0.06, gravity: -1.2, rise: 0.2 },
  trail: { n: 2, life: 1.1, colors: ['#FFFFFF', '#EEF2F7'], speed: 0.25, size: 0.22, gravity: -0.1, rise: 0.05 },
};
const AURA_MOTES = 7;
const MAX_PARTICLES = 900;
const particleMaterial = new MeshBasicMaterial({ color: '#FFFFFF' });
const colorCache = new Map<string, Color>();
const colorOf = (c: string) => colorCache.get(c) ?? (colorCache.set(c, new Color(c)), colorCache.get(c)!);

/**
 * Hit sparks, blows, poofs, dust and the ship's cloud trail: voxel particles in one instanced mesh, each
 * a pure function of the replay time. Defending Unicorns get rising golden motes over their aura (it
 * protects within two tiles) until they fall.
 */
function Particles({ plan, at }: { plan: WarPlan; at: MutableRefObject<number> }) {
  const mesh = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => plan.effects.map((e, i) => Array.from({ length: KINDS[e.kind].n }, (_, j) => [hash01(`${i}a${j}`), hash01(`${i}b${j}`), hash01(`${i}c${j}`)] as const)), [plan]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = at.current;
    let n = 0;
    const put = (x: number, y: number, z: number, size: number, color: string) => {
      if (n >= MAX_PARTICLES) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      m.setColorAt(n, colorOf(color));
      n++;
    };
    plan.effects.forEach((e: Effect, i) => {
      const kind = KINDS[e.kind];
      const age = t - e.t;
      if (age < 0 || age > kind.life) return;
      const k = age / kind.life;
      seeds[i]!.forEach(([a, b, c], j) => {
        const angle = a * Math.PI * 2;
        const v = kind.speed * (0.5 + b * 0.7);
        const up = kind.rise * (0.4 + c) * kind.speed;
        put(e.x + Math.cos(angle) * v * age, e.y + up * age - 0.5 * kind.gravity * age * age, e.z + Math.sin(angle) * v * age, kind.size * (1 - k * 0.8), kind.colors[j % kind.colors.length]!);
      });
    });
    for (const [u, aura] of plan.auras.entries()) {
      if (t >= aura.until) continue;
      for (let j = 0; j < AURA_MOTES; j++) {
        const phase = (t * 0.45 + hash01(`aura${u}${j}`)) % 1;
        const x = aura.x + (hash01(`ax${u}${j}`) - 0.5) * 4.6;
        const z = aura.z + (hash01(`az${u}${j}`) - 0.5) * 4.6;
        put(x, plan.heightAt(x, z) + 0.1 + phase * 0.9, z, 0.05 * Math.sin(phase * Math.PI), j % 2 ? '#FFE98A' : '#FFF6C9');
      }
    }
    for (let i = n; i < m.count; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[box, particleMaterial, MAX_PARTICLES]} frustumCulled={false} />;
}

/**
 * The battle replay (guidance_v2 Step 9.6, owner rework 2026-11-04; DESIGN.md 15.9): drawn in the
 * defender island's space. The ship sails in with the attackers on deck and hovers by the front edge;
 * they hop onto the island in waves and the stored duels play all over it, overlapping, with hit
 * flashes, sparks and poofs. The result is already decided; this only shows it.
 */
export function WarReplay({ war, refs, onDone }: { war: WarView; refs: WarReplayRefs; onDone: () => void }) {
  const plan = useMemo(() => {
    const { tiles } = generateIsland(war.island.world.seed, war.island.level);
    const land = tiles.filter((t) => !t.water);
    const tops = new Map(land.map((t) => [`${t.x},${t.z}`, t.top + 0.5]));
    const half = (islandSide(war.island.level) - 1) / 2;
    // The ship docks off the far left edge (−x, away from the camera) so it never hides the battle.
    const edgeX = Math.min(...land.map((t) => t.x));
    const edgeY = Math.max(...land.filter((t) => t.x <= edgeX + 1).map((t) => t.top + 0.5), 1);
    const nearestLand = (x: number, z: number): Vec2 => {
      let best = land[0]!;
      for (const t of land) if (Math.hypot(t.x - x, t.z - z) < Math.hypot(best.x - x, best.z - z)) best = t;
      return [best.x, best.z];
    };
    const heightAt = (x: number, z: number) => tops.get(`${Math.round(x)},${Math.round(z)}`) ?? tops.get(nearestLand(x, z).join(',')) ?? edgeY;
    return planWar(war, { dock: [-(half + 1.5), edgeY - 0.2, half * 0.45], heading: [0, 1], heightAt, land: nearestLand });
  }, [war]);
  const ship = useRef<Group | null>(null);
  const finished = useRef(false);
  const kinds = useMemo(() => {
    const groups = new Map<string, FighterPlan[]>();
    for (const f of plan.fighters) {
      const key = `${f.speciesId}:${f.skinId ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return [...groups];
  }, [plan]);

  useEffect(() => {
    refs.time.current = 0;
    finished.current = false;
  }, [war, refs]);

  useFrame((_, delta) => {
    if (refs.skip.current) refs.time.current = plan.total;
    else refs.time.current = Math.min(plan.total, refs.time.current + Math.min(delta, 0.1) * refs.speed.current);
    const s = shipAt(plan, refs.time.current);
    if (ship.current) {
      ship.current.position.set(...s.position);
      ship.current.rotation.set(...s.rotation, 'YXZ');
      ship.current.visible = s.visible;
    }
    if (!finished.current && refs.time.current >= plan.total) {
      finished.current = true;
      onDone();
    }
  });

  return (
    <group>
      <Ship shipRef={ship} at={refs.time} />
      {kinds.map(([key, fighters]) => (
        <FighterKind key={key} plan={plan} fighters={fighters} at={refs.time} />
      ))}
      <Particles plan={plan} at={refs.time} />
    </group>
  );
}
