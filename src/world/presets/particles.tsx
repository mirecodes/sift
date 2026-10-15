import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, Color, Group, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { hash01 } from '../../domain/random';

/** Particle presets (guidance_v2 Step 3.2). Items reference them by id (`ambient` on block themes). */

const cube = new BoxGeometry(1, 1, 1);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const SPARK_COLORS = ['#FF9AA2', '#FFD08A', '#FFF3A3', '#A8E6B0', '#9CCBFF', '#C9A6FF', '#FFFFFF', '#FFB3E6'];
const sparkMaterials = SPARK_COLORS.map((c) => new MeshBasicMaterial({ color: new Color(c), transparent: true, opacity: 0.95 }));

/** `sparkle`: at most 8 small rising sparkles around an animal. Gradients are allowed in the world only. */
export function Sparkles({ timeScale, reducedMotion }: { timeScale: number; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const t = useRef(Math.random() * 10);
  const scaleRef = useRef(timeScale);
  scaleRef.current = timeScale;

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    t.current += Math.min(delta, 0.1) * scaleRef.current;
    g.children.forEach((child, i) => {
      const phase = (t.current * 0.5 + i / 8) % 1;
      const angle = i * 2.4 + t.current * 0.3;
      const radius = 0.16 + (i % 3) * 0.05;
      child.position.set(Math.cos(angle) * radius, 0.1 + phase * 0.55, Math.sin(angle) * radius);
      child.scale.setScalar(reducedMotion ? 0.03 : Math.sin(phase * Math.PI) * 0.045);
    });
  });

  return (
    <group ref={group}>
      {sparkMaterials.map((mat, i) => (
        <mesh key={i} geometry={cube} material={mat} />
      ))}
    </group>
  );
}

const RAINBOW = ['#FF5A5F', '#FFA24D', '#FFE14D', '#5ED67A', '#4DA6FF', '#8E6BFF', '#FF8AD8'];
const rainbowMaterials = RAINBOW.map((c) => new MeshBasicMaterial({ color: new Color(c) }));
const BURST_COUNT = 14;
const BURST_LIFE = 0.9;
const GRAVITY = 4;

/** `rainbow`: every 2-5s a burst of rainbow cubes pops out around the body, arcs up and falls back shrinking. */
export function RainbowBursts({ timeScale }: { timeScale: number }) {
  const group = useRef<Group>(null);
  const scaleRef = useRef(timeScale);
  scaleRef.current = timeScale;
  const s = useRef({ t: 0, nextAt: rand(1, 3), start: -1, vel: Array.from({ length: BURST_COUNT }, () => [0, 0, 0]) });

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const st = s.current;
    st.t += Math.min(delta, 0.1) * scaleRef.current;
    if (st.start < 0 && st.t >= st.nextAt) {
      st.start = st.t;
      for (const v of st.vel) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(0.3, 1);
        v[0] = Math.cos(a) * r;
        v[1] = rand(1.2, 2.2);
        v[2] = Math.sin(a) * r;
      }
    }
    const age = st.start < 0 ? 1 : (st.t - st.start) / BURST_LIFE;
    if (st.start >= 0 && age >= 1) {
      st.start = -1;
      st.nextAt = st.t + rand(2, 5);
    }
    g.visible = st.start >= 0;
    if (!g.visible) return;
    const sec = age * BURST_LIFE;
    g.children.forEach((child, i) => {
      const v = st.vel[i]!;
      child.position.set(v[0]! * sec * 0.5, 1 + v[1]! * sec - 0.5 * GRAVITY * sec * sec, v[2]! * sec * 0.5);
      child.scale.setScalar(0.06 * (1 - age));
    });
  });

  return (
    <group ref={group} visible={false}>
      {Array.from({ length: BURST_COUNT }, (_, i) => (
        <mesh key={i} geometry={cube} material={rainbowMaterials[i % rainbowMaterials.length]} />
      ))}
    </group>
  );
}

/** A field of small cubes that drift through a box; each one lives `life` seconds, then respawns elsewhere. */
export interface ParticleSpec {
  count: number;
  colors: readonly string[];
  /** Edge in blocks at full size. */
  size: number;
  life: number;
  /** Blocks per second. */
  velocity: readonly [number, number, number];
  /** Side-to-side wobble amplitude in blocks. */
  sway?: number;
  /** Size multiplier reached at the end of life (smoke grows). */
  grow?: number;
  /** Blinks (fireflies). */
  twinkle?: boolean;
  /** Visible only at night, scaled by the night factor. */
  nightOnly?: boolean;
}

export const FIELD_PRESETS = {
  smoke: { count: 6, colors: ['#D9DCE6', '#C4C8D2'], size: 0.08, life: 2.4, velocity: [0.05, 0.35, 0], sway: 0.06, grow: 2.2 },
  leaves: { count: 22, colors: ['#E8702A', '#C94F2A', '#F2B33D'], size: 0.06, life: 6, velocity: [0.15, -0.45, 0.1], sway: 0.35 },
  petals: { count: 24, colors: ['#FFC2D6', '#FFD9E6', '#FFFFFF'], size: 0.05, life: 6, velocity: [0.2, -0.35, 0.05], sway: 0.4 },
  snow: { count: 40, colors: ['#FFFFFF', '#EEF4FF'], size: 0.05, life: 7, velocity: [0.03, -0.5, 0], sway: 0.15 },
  fireflies: { count: 12, colors: ['#E8FF7A', '#FFF59A'], size: 0.05, life: 5, velocity: [0, 0.05, 0], sway: 0.45, twinkle: true, nightOnly: true },
} as const satisfies Record<string, ParticleSpec>;

const dummy = new Object3D();

/** Position and scale of particle `i` at time `t` (pure, so it is testable and needs no per-frame state). */
export function particleAt(spec: ParticleSpec, area: readonly [number, number, number], i: number, t: number): { x: number; y: number; z: number; s: number } {
  const span = t / spec.life + hash01(7, i, 1);
  const cycle = Math.floor(span);
  const age = span - cycle;
  const [w, h, d] = area;
  const ox = (hash01(i, cycle, 2) - 0.5) * w;
  const oz = (hash01(i, cycle, 3) - 0.5) * d;
  // Falling particles start near the top, rising ones near the bottom.
  const oy = spec.velocity[1] < 0 ? h * (0.6 + 0.4 * hash01(i, cycle, 4)) : h * 0.4 * hash01(i, cycle, 4);
  const sec = age * spec.life;
  const wob = spec.sway ? Math.sin(sec * 1.7 + i) * spec.sway : 0;
  const envelope = Math.sin(age * Math.PI);
  const grow = 1 + ((spec.grow ?? 1) - 1) * age;
  const blink = spec.twinkle ? 0.5 + 0.5 * Math.sin(t * 6 + i * 1.3) : 1;
  return {
    x: ox + spec.velocity[0] * sec + wob,
    y: oy + spec.velocity[1] * sec,
    z: oz + spec.velocity[2] * sec + wob * 0.5,
    s: spec.size * envelope * grow * blink,
  };
}

interface FieldProps {
  spec: ParticleSpec;
  /** Box [width, height, depth] in blocks, centered on x/z, from y = 0 up. */
  area: readonly [number, number, number];
  timeScale: number;
  night: MutableRefObject<number>;
  reducedMotion: boolean;
}

/** One InstancedMesh for a whole field. Nothing is drawn with reduced motion. */
export function ParticleField({ spec, area, timeScale, night, reducedMotion }: FieldProps) {
  const mesh = useRef<InstancedMesh>(null);
  const t = useRef(0);
  const material = useMemo(() => new MeshBasicMaterial({ color: '#FFFFFF' }), []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    for (let i = 0; i < spec.count; i++) m.setColorAt(i, c.set(spec.colors[i % spec.colors.length] as string));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [spec]);
  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    t.current += Math.min(delta, 0.1) * timeScale;
    const fade = spec.nightOnly ? night.current : 1;
    for (let i = 0; i < spec.count; i++) {
      const p = particleAt(spec, area, i, t.current);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(Math.max(0, p.s * fade));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  if (reducedMotion) return null;
  return <instancedMesh ref={mesh} args={[cube, material, spec.count]} frustumCulled={false} />;
}
