import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, BoxGeometry, PlaneGeometry } from 'three';
import { strings } from '../../ui/strings';
import { labelTexture } from './label';
import { config } from '../../domain/config';
import { getSpecies } from '../../domain/animals/catalog';
import type { IslandAnimal } from '../../domain/island/model';
import { palette } from '../palette';
import { animalGeometry, flutterParts, modelById, VOXEL_SIZE } from '../voxel/geometry';
import { HUT_APPROACH, HUT_DOOR } from '../props/Camp';
import { CAMP_RESERVED, COIN_PILE_TILE, HUT_TILE } from '../../domain/island/island';
import { DEPART_SHRINK_S, DEPART_STAGGER_S, DepartureEffects } from './Departures';
import type { WorldMode } from '../types';

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const shadowGeometry = new CircleGeometry(0.28, 16).rotateX(-Math.PI / 2);
const shadowMaterial = new MeshBasicMaterial({ color: palette.shadow, transparent: true, opacity: 0.22, depthWrite: false });
const sparkGeometry = new BoxGeometry(1, 1, 1);
const SPARK_COLORS = ['#FF9AA2', '#FFD08A', '#FFF3A3', '#A8E6B0', '#9CCBFF', '#C9A6FF', '#FFFFFF', '#FFB3E6'];
const sparkMaterials = SPARK_COLORS.map((c) => new MeshBasicMaterial({ color: new Color(c), transparent: true, opacity: 0.95 }));

// Poke bubble (DESIGN.md 18): white voxel bubble with a dark "!".
const bubbleBox = new BoxGeometry(1, 1, 1);
const bubbleWhite = new MeshBasicMaterial({ color: '#FFFFFF' });
const bubbleInk = new MeshBasicMaterial({ color: '#1E1E1E' });
const BUBBLE_MS = 1.2;
// Time-left label (Step 2.6): same height as the "!" bubble, width from the text.
const labelPlane = new PlaneGeometry(1, 1);
const LABEL_H = 0.9;
// Butterfly flight (DESIGN.md 18): altitude in model units (0.6 block at 0.25x), wander radius and speed in blocks.
const FLY_Y = 2.4;
const FLY_RANGE = 1.2;
const FLY_SPEED = 0.8;
const FLAP_HZ = 3;
const hitMaterial = new MeshBasicMaterial({ visible: false });

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

/** Focus routines (DESIGN.md 15.4): day = run into the hut, night = sleep near it. */
type Routine = 'none' | 'hut' | 'sleep';
interface Spot {
  x: number;
  z: number;
}
const WALK = 1.6; // blocks per second
const RUN = 3;
const TAU = Math.PI * 2;
const angleDiff = (from: number, to: number) => {
  const d = (((to - from) % TAU) + TAU * 1.5) % TAU - Math.PI;
  return d;
};

type Action = 'none' | 'turn' | 'hop' | 'shuffle' | 'flop';

interface AnimState {
  time: number;
  nextAt: number;
  action: Action;
  actionStart: number;
  actionLength: number;
  yaw: number;
  fromYaw: number;
  toYaw: number;
  offX: number;
  offZ: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  tilt: number;
  spawnAt: number;
  routine: Routine;
  routineAt: number;
  delay: number;
  clock: number;
  px: number;
  pz: number;
  appear: number; // 0 = inside the hut, 1 = fully out
  lie: number;
  leg: number;
  inside: boolean;
  arrived: boolean;
  returning: boolean;
  stride: number;
  /** Smoothed ground height under the animal. */
  gy: number;
  /** `clock` time until which the poke bubble shows. */
  bubbleUntil: number;
  /** Seconds since its departure started (-1 = not leaving). */
  leaveT: number;
}

/** World y of the walkable surface at a point (nearest tile). */
export type GroundAt = (x: number, z: number) => number;

interface AnimalProps {
  ground: GroundAt;
  animal: IslandAnimal;
  timeScale: number;
  reducedMotion: boolean;
  /** True for animals that appear after the scene has mounted (reveal). */
  spawn: boolean;
  routine: Routine;
  slot: Spot;
}

const AnimalInstance = memo(function AnimalInstance({ ground, animal, timeScale, reducedMotion, spawn, routine, slot }: AnimalProps) {
  const species = getSpecies(animal.speciesId);
  const geometry = useMemo(() => animalGeometry(species.modelId), [species.modelId]);
  const model = modelById(species.modelId);
  const bodyW = model.size[0] * VOXEL_SIZE;
  const bodyH = model.size[1] * VOXEL_SIZE;
  const side = hashId(animal.id) % 2 === 0 ? 1 : -1;
  const routineRef = useRef(routine);
  routineRef.current = routine;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const bubbleRef = useRef<Group>(null);
  const hitRef = useRef<Mesh>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const flutter = species.idleAnimation === 'flutter';
  const parts = useMemo(() => (flutter ? flutterParts() : undefined), [flutter]);
  const scaleRef = useRef(timeScale);
  scaleRef.current = timeScale;

  const state = useRef<AnimState>({
    time: 0,
    nextAt: rand(1, 4),
    action: 'none',
    actionStart: 0,
    actionLength: 0,
    yaw: ((hashId(animal.id) >>> 0) % 4) * (Math.PI / 2),
    fromYaw: 0,
    toYaw: 0,
    offX: 0,
    offZ: 0,
    fromX: 0,
    fromZ: 0,
    toX: 0,
    toZ: 0,
    tilt: 0,
    spawnAt: spawn ? 0 : -1,
    // Mounting in the middle of a routine (reload during Focus) shows the end state immediately.
    routine,
    routineAt: 0,
    delay: 0,
    clock: 0,
    px: routine === 'hut' ? HUT_DOOR.x : routine === 'sleep' ? slot.x : animal.tile.x,
    pz: routine === 'hut' ? HUT_DOOR.z : routine === 'sleep' ? slot.z : animal.tile.z,
    appear: routine === 'hut' ? 0 : 1,
    lie: routine === 'sleep' ? 1 : 0,
    leg: 1,
    inside: routine === 'hut',
    arrived: routine === 'sleep',
    returning: false,
    stride: 0,
    gy: ground(animal.tile.x, animal.tile.z),
    bubbleUntil: -1,
    leaveT: -1,
  });

  // With the economy on the bubble shows the time left (Step 2.6); exempt species keep the "!".
  const timed = animal.expiresAt !== undefined;
  const labelRef = useRef<Mesh>(null);
  const labelMaterial = useMemo(() => (timed ? new MeshBasicMaterial({ transparent: true }) : null), [timed]);
  useEffect(() => () => labelMaterial?.dispose(), [labelMaterial]);

  // Poke: cancel the current action and start a new one right away (picked in the idle block below).
  const poke = (e: ThreeEvent<MouseEvent>) => {
    const s = state.current;
    if (s.routine !== 'none' || s.returning || s.appear < 1 || animal.departure !== undefined) return;
    e.stopPropagation();
    if (animal.expiresAt !== undefined && labelMaterial && labelRef.current) {
      const { texture, aspect } = labelTexture(strings.poke.timeLeft(animal.expiresAt - Date.now()));
      labelMaterial.map = texture;
      labelMaterial.needsUpdate = true;
      labelRef.current.scale.set(LABEL_H * aspect, LABEL_H, 1);
    }
    s.action = 'none';
    s.nextAt = 0;
    s.bubbleUntil = s.clock + BUBBLE_MS;
  };

  useFrame((_, delta) => {
    const g = outer.current;
    const m = inner.current;
    if (!g || !m) return;
    const s = state.current;
    const dt = Math.min(delta, 0.1);
    s.time += dt * scaleRef.current;
    s.clock += dt;

    const wanted = routineRef.current;
    if (wanted !== s.routine) {
      const from = s.routine;
      s.routine = wanted;
      s.routineAt = s.clock;
      s.delay = reducedMotion ? 0 : Math.random() * (wanted === 'hut' ? 0.8 : 1.2);
      s.leg = 0;
      s.inside = false;
      s.arrived = false;
      s.action = 'none';
      s.returning = wanted === 'none' && from !== 'none';
      if (reducedMotion) {
        const to = wanted === 'hut' ? HUT_DOOR : wanted === 'sleep' ? slotRef.current : { x: animal.tile.x + s.offX, z: animal.tile.z + s.offZ };
        s.px = to.x;
        s.pz = to.z;
        s.appear = wanted === 'hut' ? 0 : 1;
        s.inside = wanted === 'hut';
        s.arrived = wanted === 'sleep';
        s.lie = wanted === 'sleep' ? 1 : 0;
        s.returning = false;
      }
    }

    let moving = false;
    const moveTo = (tx: number, tz: number, speed: number) => {
      const dx = tx - s.px;
      const dz = tz - s.pz;
      const dist = Math.hypot(dx, dz);
      const step = speed * dt;
      if (dist <= step) {
        s.px = tx;
        s.pz = tz;
        return true;
      }
      s.px += (dx / dist) * step;
      s.pz += (dz / dist) * step;
      s.yaw += angleDiff(s.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 14);
      s.stride += dt * (speed > 2 ? 14 : 9);
      moving = true;
      return false;
    };
    const active = s.clock - s.routineAt >= s.delay;
    const idle = s.routine === 'none' && !s.returning;

    if (s.routine === 'hut') {
      if (active && !s.inside) {
        if (s.leg === 0) {
          if (moveTo(HUT_APPROACH.x, HUT_APPROACH.z, RUN)) s.leg = 1;
        } else if (moveTo(HUT_DOOR.x, HUT_DOOR.z, RUN)) s.inside = true;
      }
      if (s.inside) s.appear = Math.max(0, s.appear - dt / 0.25);
    } else {
      s.appear = Math.min(1, s.appear + dt / 0.25);
      if (s.routine === 'sleep') {
        if (active && !s.arrived && moveTo(slotRef.current.x, slotRef.current.z, WALK)) s.arrived = true;
        s.lie += ((s.arrived ? 1 : 0) - s.lie) * Math.min(1, dt * 3);
      } else {
        s.lie += (0 - s.lie) * Math.min(1, dt * 5);
        if (s.returning && active && s.lie < 0.05 && moveTo(animal.tile.x + s.offX, animal.tile.z + s.offZ, WALK)) s.returning = false;
      }
    }

    let y = 0;
    let squashY = 1;
    let squashXZ = 1;
    let tilt = 0;

    if (flutter && idle && !reducedMotion) {
      // Wander between random waypoints around the home tile; a poke (nextAt = 0) picks one at once.
      if (s.time >= s.nextAt) {
        s.toX = rand(-FLY_RANGE, FLY_RANGE);
        s.toZ = rand(-FLY_RANGE, FLY_RANGE);
        s.nextAt = s.time + rand(1.5, 3.5);
      }
      const dx = s.toX - s.offX;
      const dz = s.toZ - s.offZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.02) {
        const step = Math.min(dist, FLY_SPEED * (s.clock < s.bubbleUntil ? 2.5 : 1) * dt * scaleRef.current);
        s.offX += (dx / dist) * step;
        s.offZ += (dz / dist) * step;
        s.yaw += angleDiff(s.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      }
    }

    if (!reducedMotion && idle && !flutter) {
      if (s.action === 'none' && s.time >= s.nextAt) {
        const flop = species.idleAnimation === 'flop';
        const pick = Math.random();
        s.action = flop ? 'flop' : pick < 0.4 ? 'hop' : pick < 0.75 ? 'turn' : 'shuffle';
        s.actionStart = s.time;
        if (s.action === 'turn') {
          s.actionLength = 0.45;
          s.fromYaw = s.yaw;
          s.toYaw = s.yaw + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2);
        } else if (s.action === 'hop') {
          s.actionLength = 0.35;
        } else if (s.action === 'flop') {
          s.actionLength = 0.55;
          s.tilt = (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.6);
        } else {
          s.actionLength = 0.9;
          s.fromX = s.offX;
          s.fromZ = s.offZ;
          s.toX = rand(-0.35, 0.35);
          s.toZ = rand(-0.35, 0.35);
        }
      }
      if (s.action !== 'none') {
        const p = Math.min(1, (s.time - s.actionStart) / s.actionLength);
        switch (s.action) {
          case 'turn':
            s.yaw = s.fromYaw + (s.toYaw - s.fromYaw) * easeInOut(p);
            break;
          case 'hop':
            y = Math.sin(p * Math.PI) * 0.18;
            break;
          case 'flop': {
            const arc = Math.sin(p * Math.PI);
            y = arc * 0.28;
            squashY = 1 + arc * 0.18 - (p < 0.15 || p > 0.85 ? 0.22 : 0);
            squashXZ = 1 / Math.sqrt(squashY);
            tilt = s.tilt * arc;
            break;
          }
          case 'shuffle':
            s.offX = s.fromX + (s.toX - s.fromX) * easeInOut(p);
            s.offZ = s.fromZ + (s.toZ - s.fromZ) * easeInOut(p);
            break;
        }
        if (p >= 1) {
          s.action = 'none';
          s.nextAt = s.time + (species.idleAnimation === 'flop' ? rand(2, 4) : rand(3, 8));
        }
      }
    }

    const bubble = bubbleRef.current;
    if (bubble) {
      bubble.visible = idle && s.clock < s.bubbleUntil;
      bubble.position.y = bodyH + 0.8 + y;
    }

    let spawnScale = 1;
    if (s.spawnAt >= 0) {
      if (reducedMotion) s.spawnAt = -1;
      else {
        s.spawnAt += Math.min(delta, 0.1);
        const p = Math.min(1, s.spawnAt / 0.3);
        spawnScale = 0.6 + 0.4 * easeInOut(p);
        if (p >= 1) s.spawnAt = -1;
      }
    }

    if (idle) {
      s.px = animal.tile.x + s.offX;
      s.pz = animal.tile.z + s.offZ;
    }
    if (moving) y = Math.abs(Math.sin(s.stride)) * 0.14;
    const lie = easeInOut(Math.min(1, Math.max(0, s.lie)));
    if (flutter) {
      // Airborne unless asleep; wings flap, or fold up while lying down.
      y = (FLY_Y + (reducedMotion ? 0 : Math.sin(s.clock * 2.3) * 0.35)) * (1 - lie);
      const flap = reducedMotion ? 0.3 : 0.15 + 0.7 * (0.5 + 0.5 * Math.sin(s.clock * Math.PI * 2 * FLAP_HZ * (s.clock < s.bubbleUntil ? 1.5 : 1)));
      const angle = flap * (1 - lie) + lie * 1.2;
      if (wingL.current && wingR.current) {
        wingL.current.rotation.z = -angle;
        wingR.current.rotation.z = angle;
      }
      if (hitRef.current) hitRef.current.position.y = bodyH / 2 + y;
    }
    // Departure: shrink away in notice order; beyond the animated cap (or reduced motion) vanish at once.
    let leave = 1;
    if (animal.departure !== undefined) {
      s.leaveT = Math.max(0, s.leaveT) + dt;
      const instant = reducedMotion || animal.departure >= config.render.maxAnimatedDepartures;
      leave = instant ? 0 : 1 - Math.min(1, Math.max(0, (s.leaveT - animal.departure * DEPART_STAGGER_S) / DEPART_SHRINK_S));
    }

    const breath = 1 + Math.sin(s.clock * 2.2 + side) * 0.035 * lie;
    const ox = side * lie * (bodyH / 2);
    const size = spawnScale * s.appear * breath * leave;
    g.visible = s.appear > 0.001 && leave > 0.001;
    g.scale.setScalar(config.render.animalScale);
    const gy = ground(s.px, s.pz);
    s.gy = reducedMotion ? gy : s.gy + (gy - s.gy) * Math.min(1, delta * 12);
    g.position.set(s.px, s.gy, s.pz);
    m.position.set(ox * Math.cos(s.yaw), y + lie * (bodyW / 2), -ox * Math.sin(s.yaw));
    m.rotation.set(0, s.yaw, tilt + side * lie * (Math.PI / 2));
    m.scale.set(squashXZ * size, squashY * size, squashXZ * size);
  });

  return (
    <group ref={outer} position={[animal.tile.x, ground(animal.tile.x, animal.tile.z), animal.tile.z]}>
      <mesh geometry={shadowGeometry} material={shadowMaterial} position={[0, 0.005, 0]} />
      {/* Invisible hit box: animals are tiny (0.25x), so the model alone is hard to click. */}
      <mesh ref={hitRef} material={hitMaterial} geometry={bubbleBox} position={[0, bodyH / 2, 0]} scale={[Math.max(bodyW, 1), bodyH + 0.2, Math.max(bodyW, 1)]} onClick={poke} />
      <group ref={bubbleRef} visible={false} rotation={[0, Math.PI / 4, 0]} scale={1.2}>
        {labelMaterial ? (
          <mesh ref={labelRef} geometry={labelPlane} material={labelMaterial} />
        ) : (
          <>
            <mesh geometry={bubbleBox} material={bubbleWhite} scale={[0.9, 0.9, 0.1]} />
            <mesh geometry={bubbleBox} material={bubbleInk} scale={[0.14, 0.36, 0.04]} position={[0, 0.12, 0.07]} />
            <mesh geometry={bubbleBox} material={bubbleInk} scale={[0.14, 0.14, 0.04]} position={[0, -0.25, 0.07]} />
          </>
        )}
        <mesh geometry={bubbleBox} material={bubbleWhite} scale={[0.2, 0.2, 0.1]} position={[0, -0.55, 0]} />
      </group>
      <group ref={inner}>
        {parts ? (
          <>
            <mesh geometry={parts.body} material={material} />
            <group ref={wingL} position={[-VOXEL_SIZE, VOXEL_SIZE, 0]}>
              <mesh geometry={parts.wing} material={material} position={[-VOXEL_SIZE, 0, 0]} />
            </group>
            <group ref={wingR} position={[VOXEL_SIZE, VOXEL_SIZE, 0]}>
              <mesh geometry={parts.wing} material={material} position={[VOXEL_SIZE, 0, 0]} scale={[-1, 1, 1]} />
            </group>
          </>
        ) : (
          <mesh geometry={geometry} material={material} />
        )}
        {(species.idleAnimation === 'sparkle' || species.idleAnimation === 'rainbow') && <Sparkles timeScale={timeScale} reducedMotion={reducedMotion} />}
        {species.idleAnimation === 'rainbow' && !reducedMotion && <RainbowBursts timeScale={timeScale} />}
      </group>
    </group>
  );
});

/** Unicorn effect: at most 8 small rising sparkles. Gradients are allowed in the world only. */
function Sparkles({ timeScale, reducedMotion }: { timeScale: number; reducedMotion: boolean }) {
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
        <mesh key={i} geometry={sparkGeometry} material={mat} />
      ))}
    </group>
  );
}

const RAINBOW = ['#FF5A5F', '#FFA24D', '#FFE14D', '#5ED67A', '#4DA6FF', '#8E6BFF', '#FF8AD8'];
const rainbowMaterials = RAINBOW.map((c) => new MeshBasicMaterial({ color: new Color(c) }));
const BURST_COUNT = 14;
const BURST_LIFE = 0.9;
const GRAVITY = 4;

/** Unicorn: every 2-5s a burst of rainbow cubes pops out around the body, arcs up and falls back shrinking. */
function RainbowBursts({ timeScale }: { timeScale: number }) {
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
        <mesh key={i} geometry={sparkGeometry} material={rainbowMaterials[i % rainbowMaterials.length]} />
      ))}
    </group>
  );
}

interface AnimalsProps {
  animals: readonly IslandAnimal[];
  tiles: readonly (Spot & { top: number; water?: boolean })[];
  mode: WorldMode;
  dark: boolean;
  timeScale: number;
  reducedMotion: boolean;
}

const SLOT_OFFSETS = [
  [-0.25, -0.2],
  [0.25, -0.2],
  [0, 0.25],
] as const;

/** Sleeping spots: the tiles nearest the hut (front first), up to three animals per tile; never water or camp. */
function sleepSpots(tiles: readonly (Spot & { water?: boolean })[]): Spot[] {
  const dist = (t: Spot) => Math.hypot(t.x - HUT_TILE.x, t.z - HUT_TILE.z);
  return tiles
    .filter((t) => !t.water && !CAMP_RESERVED.some((c) => c.x === t.x && c.z === t.z))
    .sort((a, b) => dist(a) - dist(b) || b.z - a.z || a.x - b.x)
    .flatMap((t) => SLOT_OFFSETS.map(([dx, dz]) => ({ x: t.x + dx, z: t.z + dz })));
}

export function Animals({ animals, tiles, mode, dark, timeScale, reducedMotion }: AnimalsProps) {
  const routine: Routine = mode === 'focus' ? (dark ? 'sleep' : 'hut') : 'none';
  const slots = useMemo(() => {
    const spots = sleepSpots(tiles);
    const ids = animals.map((a) => a.id).sort();
    return new Map(ids.map((id, i) => [id, spots[i] ?? spots[spots.length - 1] ?? { x: 0, z: 0 }]));
  }, [animals, tiles]);
  const ground = useMemo<GroundAt>(() => {
    const tops = new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top + 0.5]));
    return (x, z) => tops.get(`${Math.round(x)},${Math.round(z)}`) ?? 0.5;
  }, [tiles]);
  // Animals present at first render appear instantly; later arrivals (the reveal) pop in.
  const initial = useRef<Set<string> | null>(null);
  initial.current ??= new Set(animals.map((a) => a.id));
  const departing = useMemo(() => animals.filter((a) => a.departure !== undefined).sort((a, b) => a.departure! - b.departure!), [animals]);
  const max = config.render.maxAnimatedDepartures;
  return (
    <group>
      {animals.map((a) => (
        <AnimalInstance ground={ground} key={a.id} animal={a} timeScale={timeScale} reducedMotion={reducedMotion} spawn={!initial.current!.has(a.id)} routine={routine} slot={slots.get(a.id)!} />
      ))}
      {departing.length > 0 && !reducedMotion && mode !== 'focus' && (
        <DepartureEffects
          key={departing.map((a) => a.id).join()}
          from={departing.slice(0, max).map((a) => a.tile)}
          burst={departing.length > max}
          pile={COIN_PILE_TILE}
          ground={ground}
        />
      )}
    </group>
  );
}
