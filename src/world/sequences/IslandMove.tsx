import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, Vector3, type Group } from 'three';
import { config } from '../../domain/config';
import { getSpecies } from '../../domain/animals/catalog';
import { generateIsland, type Tile } from '../../domain/island/island';
import { palette } from '../palette';
import { animalGeometry } from '../voxel/geometry';
import { arcPoint, moverPose, planIslandMove, stageAt, type MovePlan, type MoverPlan, type Vec3 } from './moveTimeline';

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const stripeMaterial = new MeshLambertMaterial({ flatShading: true });
const unitBox = new BoxGeometry(1, 1, 1);
const STRIPES = palette.rainbowBridge;
const burstMaterials = STRIPES.map((color) => new MeshBasicMaterial({ color }));
const SEGMENTS = 48;
const STRIPE_W = 0.12;
const STRIPE_H = 0.08;
const BURST = 14;
const dummy = new Object3D();
const tmp = new Vector3();

export interface MoveAnimal {
  id: string;
  speciesId: string;
  skinId: string;
  from: Tile;
  to: Tile;
}

/** Everything the sequence draws; refs are shared with the islands it moves (`IslandMotion`, `Scene.pan`). */
export interface IslandMoveProps {
  oldIsland: { seed: number; level: number };
  newIsland: { seed: number; level: number };
  /** Animals that cross; the Unicorn leads and dissolves. */
  movers: readonly MoveAnimal[];
  unicorn: Omit<MoveAnimal, 'to'> | null;
  positions: readonly [number, number, number][];
  refs: IslandMoveRefs;
  onDone: () => void;
}

export interface IslandMoveRefs {
  oldLift: MutableRefObject<number>;
  newLift: MutableRefObject<number>;
  oldBob: MutableRefObject<number>;
  newBob: MutableRefObject<number>;
  pan: MutableRefObject<number>;
}

/** Surface height per tile (`top + 0.5`), land tiles only. */
function surface(seed: number, level: number) {
  const tiles = generateIsland(seed, level).tiles.filter((t) => !t.water);
  return { tiles, top: new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top + 0.5])) };
}

/** Bridge ends (the land tiles of each island facing the other) and every animal's start and end point. */
function usePlan(p: IslandMoveProps): MovePlan | null {
  const [p0, p1] = p.positions;
  return useMemo(() => {
    if (!p0 || !p1) return null;
    const oldS = surface(p.oldIsland.seed, p.oldIsland.level);
    const newS = surface(p.newIsland.seed, p.newIsland.level);
    const dx = p1[0] - p0[0];
    const dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dz) || 1;
    const [ux, uz] = [dx / len, dz / len];
    const proj = (t: Tile, at: readonly number[]) => (t.x + at[0]!) * ux + (t.z + at[2]!) * uz;
    const edgeOld = oldS.tiles.reduce((best, t) => (proj(t, p0) > proj(best, p0) ? t : best));
    const edgeNew = newS.tiles.reduce((best, t) => (proj(t, p1) < proj(best, p1) ? t : best));
    const a: Vec3 = [edgeOld.x + p0[0] + ux * 0.45, edgeOld.top + 0.5, edgeOld.z + p0[2] + uz * 0.45];
    const b: Vec3 = [edgeNew.x + p1[0] - ux * 0.45, edgeNew.top + 0.5, edgeNew.z + p1[2] - uz * 0.45];
    const onOld = (t: Tile): Vec3 => [t.x + p0[0], oldS.top.get(`${t.x},${t.z}`) ?? 1, t.z + p0[2]];
    const onNew = (t: Tile): Vec3 => [t.x + p1[0], newS.top.get(`${t.x},${t.z}`) ?? 1, t.z + p1[2]];
    return planIslandMove({
      a,
      b,
      unicorn: p.unicorn && { id: p.unicorn.id, from: onOld(p.unicorn.from), to: b },
      movers: p.movers.map((m) => ({ id: m.id, from: onOld(m.from), to: onNew(m.to) })),
    });
    // The plan is fixed for the whole sequence; only the layout can still settle.
  }, [p0?.[0], p0?.[2], p1?.[0], p1?.[2]]);
}

function Mover({ animal, register }: { animal: Omit<MoveAnimal, 'to'>; register: (id: string, g: Group | null) => void }) {
  const species = getSpecies(animal.speciesId);
  const geometry = useMemo(() => animalGeometry(species.modelId, animal.skinId), [species.modelId, animal.skinId]);
  return (
    <group ref={(g) => register(animal.id, g)}>
      <mesh geometry={geometry} material={material} scale={config.render.animalScale} />
    </group>
  );
}

/** The rainbow bridge: six colored stripes of voxel segments along the arch, shown between two fractions. */
function Bridge({ plan, span }: { plan: MovePlan; span: MutableRefObject<[number, number]> }) {
  const mesh = useRef<InstancedMesh>(null);
  const shown = useRef('');
  const segments = useMemo(() => {
    const out: { pos: Vec3; next: Vec3; u: number }[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const u = (i + 0.5) / SEGMENTS;
      out.push({ pos: arcPoint(plan, u), next: arcPoint(plan, Math.min(1, u + 0.5 / SEGMENTS)), u });
    }
    return out;
  }, [plan]);
  const length = useMemo(() => {
    let l = 0;
    for (let i = 1; i <= 32; i++) {
      const p = arcPoint(plan, (i - 1) / 32);
      const q = arcPoint(plan, i / 32);
      l += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    }
    return l / SEGMENTS + 0.02;
  }, [plan]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    for (let s = 0; s < STRIPES.length; s++) for (let i = 0; i < SEGMENTS; i++) m.setColorAt(s * SEGMENTS + i, c.set(STRIPES[s]!));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  // Sideways across the bridge (horizontal, perpendicular to its direction).
  const side = useMemo(() => {
    const dx = plan.b[0] - plan.a[0];
    const dz = plan.b[2] - plan.a[2];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l] as const;
  }, [plan]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const [from, to] = span.current;
    const key = `${Math.round(from * SEGMENTS * 2)}:${Math.round(to * SEGMENTS * 2)}`;
    if (key === shown.current) return;
    shown.current = key;
    for (let s = 0; s < STRIPES.length; s++) {
      const off = (s - (STRIPES.length - 1) / 2) * STRIPE_W;
      for (let i = 0; i < SEGMENTS; i++) {
        const { pos, next, u } = segments[i]!;
        const visible = u >= from && u <= to;
        dummy.position.set(pos[0] + side[0] * off, pos[1] - STRIPE_H / 2, pos[2] + side[1] * off);
        dummy.lookAt(tmp.set(next[0] + side[0] * off, next[1] - STRIPE_H / 2, next[2] + side[1] * off));
        dummy.scale.set(visible ? STRIPE_W : 0, visible ? STRIPE_H : 0, visible ? length : 0);
        dummy.updateMatrix();
        m.setMatrixAt(s * SEGMENTS + i, dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[unitBox, stripeMaterial, STRIPES.length * SEGMENTS]} frustumCulled={false} />;
}

/** Rainbow cubes popping out where the Unicorn dissolves. */
function Burst({ at, start, clock }: { at: Vec3; start: number; clock: MutableRefObject<number> }) {
  const group = useRef<Group>(null);
  const dirs = useMemo(() => Array.from({ length: BURST }, (_, i) => [Math.cos((i / BURST) * Math.PI * 2), 0.6 + (i % 3) * 0.25, Math.sin((i / BURST) * Math.PI * 2)] as const), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = (clock.current - start) / 0.9;
    g.visible = k > 0 && k < 1;
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      const d = dirs[i]!;
      c.position.set(d[0] * k * 0.7, d[1] * k * 1.2 - k * k * 0.9, d[2] * k * 0.7);
      c.scale.setScalar(0.09 * (1 - k));
    });
  });
  return (
    <group ref={group} position={at as [number, number, number]} visible={false}>
      {dirs.map((_, i) => (
        <mesh key={i} geometry={unitBox} material={burstMaterials[i % burstMaterials.length]} />
      ))}
    </group>
  );
}

/**
 * The island move (guidance_v2 Step 4.3): drives both islands' lifts and the pan through the shared
 * refs, draws the bridge and every animal crossing it, and calls `onDone` at the end. The move is
 * already saved; this only plays it.
 */
export function IslandMoveSequence(props: IslandMoveProps) {
  const plan = usePlan(props);
  const clock = useRef(0);
  const groups = useRef(new Map<string, Group>());
  const span = useRef<[number, number]>([0, 0]);
  const finished = useRef(false);
  const register = (id: string, g: Group | null) => {
    if (g) groups.current.set(id, g);
    else groups.current.delete(id);
  };
  const byId = useMemo(() => new Map(plan ? [...plan.movers, ...(plan.unicorn ? [plan.unicorn] : [])].map((m) => [m.id, m]) : []), [plan]);
  const { refs, onDone } = props;

  useEffect(() => () => {
    refs.oldLift.current = 0;
    refs.newLift.current = 0;
  }, [refs]);

  useFrame((_, delta) => {
    if (!plan) return;
    const t = (clock.current += Math.min(delta, 0.1));
    const stage = stageAt(plan, t);
    refs.newLift.current = stage.newLift;
    refs.oldLift.current = stage.oldLift;
    refs.pan.current = stage.pan;
    span.current = [stage.bridgeFrom, stage.bridgeTo];
    for (const [id, g] of groups.current) {
      const m: MoverPlan | undefined = byId.get(id);
      if (!m) continue;
      const { pos, leg, heading } = moverPose(plan, m, t);
      const moving = leg !== 'home' && leg !== 'arrived';
      const bob = leg === 'home' || leg === 'toBridge' ? refs.oldBob.current : leg === 'bridge' ? 0 : refs.newBob.current;
      const hop = moving ? Math.abs(Math.sin(t * 9)) * 0.06 : 0;
      g.position.set(pos[0], pos[1] + bob + hop, pos[2]);
      if (heading[0] || heading[2]) g.rotation.y = Math.atan2(heading[0], heading[2]);
      if (plan.unicorn && id === plan.unicorn.id) g.scale.setScalar(stage.unicornScale);
    }
    if (stage.done && !finished.current) {
      finished.current = true;
      onDone();
    }
  });

  if (!plan) return null;
  return (
    <group>
      <Bridge plan={plan} span={span} />
      {props.unicorn && <Mover animal={props.unicorn} register={register} />}
      {props.movers.map((m) => (
        <Mover key={m.id} animal={m} register={register} />
      ))}
      {plan.unicorn && <Burst at={plan.b} start={plan.unicorn.land} clock={clock} />}
    </group>
  );
}
