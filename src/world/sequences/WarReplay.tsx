import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, MeshBasicMaterial, MeshLambertMaterial, Object3D, type Group, type InstancedMesh } from 'three';
import type { WarView } from '../../../shared/api/types';
import { getSpecies } from '../../domain/animals/catalog';
import { config } from '../../domain/config';
import { generateIsland, islandSide } from '../../domain/island/island';
import { animalGeometry } from '../voxel/geometry';
import { planWar, poseAt, shipAt, type FighterPlan, type WarPlan } from './warTimeline';

const box = new BoxGeometry(1, 1, 1);
const wood = new MeshLambertMaterial({ color: '#8A5A34', flatShading: true });
const woodDark = new MeshLambertMaterial({ color: '#5E3B22', flatShading: true });
const canvas = new MeshLambertMaterial({ color: '#F4EBDD', flatShading: true });
const stripe = new MeshLambertMaterial({ color: '#E8554E', flatShading: true });
const aura = new MeshBasicMaterial({ color: '#FFF4B8', transparent: true, opacity: 0.22, depthWrite: false });
const base = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Shared with the screen: playback speed (1 or 2) and Skip. */
export interface WarReplayRefs {
  speed: MutableRefObject<number>;
  skip: MutableRefObject<boolean>;
  /** Seconds into the replay (read by the screen for its result panel). */
  time: MutableRefObject<number>;
}

/** The voxel airship (DESIGN.md 15.9): hull, cabin and a striped balloon on ropes. */
function Airship({ shipRef }: { shipRef: MutableRefObject<Group | null> }) {
  return (
    <group ref={shipRef}>
      <mesh geometry={box} material={wood} scale={[2.6, 0.45, 1.1]} />
      <mesh geometry={box} material={woodDark} scale={[2.8, 0.12, 1.2]} position={[0, 0.25, 0]} />
      <mesh geometry={box} material={woodDark} scale={[0.6, 0.35, 0.6]} position={[-0.6, 0.45, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={box} material={woodDark} scale={[0.04, 1.1, 0.04]} position={[s * 0.9, 0.85, 0]} />
      ))}
      <mesh geometry={box} material={canvas} scale={[3.2, 1.1, 1.5]} position={[0, 1.8, 0]} />
      <mesh geometry={box} material={stripe} scale={[3.22, 0.25, 1.52]} position={[0, 1.8, 0]} />
    </group>
  );
}

const dummy = new Object3D();

/**
 * All fighters of one species and skin in one instanced mesh (Step 9.9: up to 2 × 100 animals in a few
 * draw calls). Fading is drawn as shrinking while tipping over, so instances need no own material.
 */
function FighterKind({ plan, fighters, at, heightAt }: { plan: WarPlan; fighters: FighterPlan[]; at: MutableRefObject<number>; heightAt: (x: number, z: number) => number }) {
  const mesh = useRef<InstancedMesh>(null);
  const f0 = fighters[0]!;
  const geometry = useMemo(() => animalGeometry(getSpecies(f0.speciesId).modelId, f0.skinId), [f0.speciesId, f0.skinId]);
  const s = config.render.animalScale;
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    fighters.forEach((f, i) => {
      const p = poseAt(plan, f, at.current);
      dummy.position.set(p.x, heightAt(p.x, p.z) + p.lift, p.z);
      // Attackers face the island (−z), defenders face the dock (+z).
      dummy.rotation.set(p.tilt, f.side === 'attacker' ? Math.PI : 0, 0);
      const k = p.opacity < 0.01 ? 0 : s * (0.35 + 0.65 * p.opacity);
      dummy.scale.set(k * p.squash, k / p.squash, k * p.squash);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, base, fighters.length]} frustumCulled={false} />;
}

/**
 * The battle replay (guidance_v2 Step 9.6, DESIGN.md 15.9): drawn in the defender island's space. The
 * airship docks at a wooden landing strip off the island's front edge; attackers hop down into formation;
 * a soft glow marks each defending Unicorn's protected square; then the stored rounds play. The result
 * is already decided; this only shows it.
 */
export function WarReplay({ war, refs, onDone }: { war: WarView; refs: WarReplayRefs; onDone: () => void }) {
  const plan = useMemo(() => planWar(war), [war]);
  const { tops, half, dockY } = useMemo(() => {
    const { tiles } = generateIsland(war.island.world.seed, war.island.level);
    const half = (islandSide(war.island.level) - 1) / 2;
    const front = tiles.filter((t) => !t.water && t.z === Math.max(...tiles.map((x) => x.z)));
    return { tops: new Map(tiles.filter((t) => !t.water).map((t) => [`${t.x},${t.z}`, t.top + 0.5])), half, dockY: Math.max(...front.map((t) => t.top), 1) + 0.5 };
  }, [war]);
  const heightAt = useMemo(() => (x: number, z: number) => tops.get(`${Math.round(x)},${Math.round(z)}`) ?? dockY, [tops, dockY]);
  const rows = Math.max(1, Math.ceil(war.attackers.length / Math.max(3, 2 * half + 1)));
  const dockDepth = 1.2 + rows * 0.8;
  const dock: [number, number, number] = [0, dockY + 0.6, half + 1.6 + dockDepth];
  const ship = useRef<Group | null>(null);
  const finished = useRef(false);
  const unicorns = war.defenders.filter((d) => d.speciesId === 'unicorn');
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
  }, [war, refs]);

  useFrame((_, delta) => {
    if (refs.skip.current) refs.time.current = plan.total;
    else refs.time.current = Math.min(plan.total, refs.time.current + Math.min(delta, 0.1) * refs.speed.current);
    const s = shipAt(plan, refs.time.current, dock);
    if (ship.current) {
      ship.current.position.set(...s.position);
      ship.current.visible = s.visible;
    }
    if (!finished.current && refs.time.current >= plan.total) {
      finished.current = true;
      onDone();
    }
  });

  return (
    <group>
      {/* Landing strip off the front edge. */}
      <mesh geometry={box} material={wood} scale={[2 * half + 1, 0.12, dockDepth]} position={[0, dockY - 0.06, half + 0.5 + dockDepth / 2]} />
      {unicorns.map((u) => (
        <mesh key={u.id} geometry={box} material={aura} scale={[5, 0.02, 5]} position={[u.x, (tops.get(`${u.x},${u.z}`) ?? dockY) + 0.02, u.z]} />
      ))}
      <Airship shipRef={ship} />
      {kinds.map(([key, fighters]) => (
        <FighterKind key={key} plan={plan} fighters={fighters} at={refs.time} heightAt={heightAt} />
      ))}
    </group>
  );
}
