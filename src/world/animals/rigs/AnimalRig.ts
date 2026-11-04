import { Bone, Euler, Quaternion, Vector3 } from 'three';
import type { AnimalPartName } from '../../../../shared/content/anatomy';
import type { TierRank } from '../../../domain/config';
import { VOXEL_SIZE, type RigBone } from '../../voxel/geometry';

/**
 * Articulated animal motion (ADR-055). A rig owns one `Bone` per model part (plus the body bone) and
 * poses them every frame in layers: rest → ambient (ear twitch, tail sway) → gait (while walking) →
 * the current motion → sleep. Subclasses add parts' behavior and motions; a motion declares the tier
 * it unlocks at (`minRank`) and the parts it needs, so one class serves every species of its kind and
 * higher tiers simply know more motions.
 *
 * Angles: `rotation.x` > 0 swings a leg's foot backward, tips a head down and lifts a tail; `rotation.y`
 * turns left/right; `rotation.z` < 0 opens a low-x (`L`) wing or ear outward, > 0 the `R` one.
 */

export const TAU = Math.PI * 2;

/** What `Animals` knows about the animal this frame. */
export interface RigFrame {
  /** Scaled seconds (Focus slows animals). */
  t: number;
  /** Walk cycle phase in radians; advances while the animal moves. */
  stride: number;
  /** 1 while walking or shuffling, else 0. */
  walk: number;
  /** 0..1..0 arc of a hop or flop. */
  hop: number;
  /** 0..1 lying down asleep. */
  lie: number;
  /** True for a moment after a poke. */
  excited: boolean;
}

export interface Motion {
  id: string;
  /** Lowest tier rank that knows this motion. */
  minRank: TierRank;
  /** Parts it moves; a rig without one of them skips the motion. */
  needs: readonly AnimalPartName[];
  /** Seconds (scaled). */
  length: number;
  /** `p` 0..1 progress, `w` 0..1 eased weight (in, hold, out). */
  play(p: number, w: number, f: RigFrame): void;
}

/** 0 → 1 → 0 with eased ends; `edge` = share of the motion spent easing in (and out). */
export function envelope(p: number, edge = 0.2): number {
  const s = (x: number) => x * x * (3 - 2 * x);
  if (p <= 0 || p >= 1) return 0;
  if (p < edge) return s(p / edge);
  if (p > 1 - edge) return s((1 - p) / edge);
  return 1;
}

/** A short 0..1..0 blip every `period` seconds (ear twitch, tail flick), offset by `phase`. */
export function blip(t: number, period: number, phase: number, length = 0.25): number {
  const k = (((t + phase * period) % period) + period) % period;
  return k < length ? Math.sin((k / length) * Math.PI) : 0;
}

const tmpQ = new Quaternion();
const tmpV = new Vector3();

export abstract class AnimalRig {
  /** Body bone: every part hangs off it. Add it to the `SkinnedMesh`. */
  readonly root = new Bone();
  /** Skeleton order: body, then the parts in `RigBone` order. */
  readonly bones: Bone[];
  private readonly byName = new Map<AnimalPartName, { bone: Bone; rest: Vector3; pivot: Vector3 }>();
  /** Random per animal, so a herd does not twitch in step. */
  protected readonly phase = Math.random();
  private list: Motion[] | null = null;
  private current: { motion: Motion; start: number } | null = null;
  private last = '';
  private readonly bodyRot = new Euler();
  private readonly bodyPivot = new Vector3();
  private readonly bodyShift = new Vector3();

  constructor(
    spec: readonly RigBone[],
    readonly rank: TierRank,
  ) {
    this.root.name = 'body';
    this.bones = [this.root];
    for (const b of spec) {
      const bone = new Bone();
      bone.name = b.name;
      const parent = b.parent >= 0 ? spec[b.parent]! : null;
      const rest = new Vector3(...b.pivot);
      if (parent) rest.sub(new Vector3(...parent.pivot));
      bone.position.copy(rest);
      (parent ? this.bones[b.parent + 1]! : this.root).add(bone);
      this.bones.push(bone);
      this.byName.set(b.name, { bone, rest, pivot: new Vector3(...b.pivot) });
    }
  }

  /** Every motion this kind of animal can make; subclasses extend `super.repertoire()`. */
  protected repertoire(): Motion[] {
    return [
      { id: 'look', minRank: 0, needs: ['head'], length: 1.8, play: (p, w) => this.turn('head', -0.08 * w, Math.sin(p * TAU) * 0.65 * w, 0) },
      { id: 'nod', minRank: 0, needs: ['head'], length: 1.2, play: (p, w) => this.turn('head', (0.3 + 0.15 * Math.sin(p * TAU * 3)) * w, 0, 0) },
      { id: 'tilt', minRank: 1, needs: ['head'], length: 1.5, play: (p, w) => this.turn('head', -0.12 * w, 0, Math.sin(p * TAU) * 0.4 * w) },
    ];
  }

  /** The motions this animal knows: its tier's and those whose parts it has. */
  get motions(): readonly Motion[] {
    this.list ??= this.repertoire().filter((m) => m.minRank <= this.rank && m.needs.every((n) => this.has(n)));
    return this.list;
  }

  has(name: AnimalPartName): boolean {
    return this.byName.has(name);
  }

  /** Starts a random motion (not the last one again, when there is a choice); returns its length, 0 if none. */
  play(t: number, rng: () => number = Math.random): number {
    const pool = this.motions.length > 1 ? this.motions.filter((m) => m.id !== this.last) : this.motions;
    const motion = pool[Math.floor(rng() * pool.length)];
    if (!motion) return 0;
    this.current = { motion, start: t };
    this.last = motion.id;
    return motion.length;
  }

  /** Starts a motion by id (tests, Studio); returns its length, 0 if this animal does not know it. */
  playById(id: string, t: number): number {
    const motion = this.motions.find((m) => m.id === id);
    if (!motion) return 0;
    this.current = { motion, start: t };
    this.last = id;
    return motion.length;
  }

  get playing(): string | null {
    return this.current?.motion.id ?? null;
  }

  stop(): void {
    this.current = null;
  }

  /** Poses every bone for this frame. */
  update(f: RigFrame): void {
    this.reset();
    this.ambient(f);
    if (f.walk > 0) this.gait(f);
    if (f.hop > 0) this.hop(f.hop, f);
    if (this.current) {
      const p = (f.t - this.current.start) / this.current.motion.length;
      if (p >= 1 || f.lie > 0.01) this.current = null;
      else this.current.motion.play(p, envelope(p), f);
    }
    if (f.lie > 0) this.sleep(f.lie, f);
    this.applyBody();
  }

  /** Reduced motion: the rest pose (subclasses may hold a still pose, e.g. half-open wings). */
  still(): void {
    this.current = null;
    this.reset();
    this.applyBody();
  }

  protected ambient(_f: RigFrame): void {}
  protected gait(_f: RigFrame): void {}
  protected hop(_arc: number, _f: RigFrame): void {}
  protected sleep(lie: number, _f: RigFrame): void {
    this.turn('head', 0.35 * lie, 0, 0);
  }

  /** Adds a rotation to a part (no-op when the model lacks it). */
  protected turn(name: AnimalPartName, x: number, y: number, z: number): void {
    const b = this.byName.get(name)?.bone;
    if (!b) return;
    b.rotation.x += x;
    b.rotation.y += y;
    b.rotation.z += z;
  }

  /** Moves a part, in voxels of the model. */
  protected shift(name: AnimalPartName, x: number, y: number, z: number): void {
    const b = this.byName.get(name)?.bone;
    if (!b) return;
    b.position.x += x * VOXEL_SIZE;
    b.position.y += y * VOXEL_SIZE;
    b.position.z += z * VOXEL_SIZE;
  }

  /** Joint of a part in model space (body origin = bottom center), or the origin when missing. */
  protected jointOf(name: AnimalPartName): Vector3 {
    return this.byName.get(name)?.pivot ?? tmpV.set(0, 0, 0);
  }

  /**
   * Turns the whole body around the point (0, `pivotY`, `pivotZ`) in model units and moves it by
   * `shiftY`/`shiftZ` voxels; the latest call in a frame sets the pivot, rotations and shifts add up.
   */
  protected body(x: number, y: number, z: number, pivotZ = 0, pivotY = 0, shiftY = 0, shiftZ = 0): void {
    this.bodyRot.x += x;
    this.bodyRot.y += y;
    this.bodyRot.z += z;
    this.bodyPivot.set(0, pivotY, pivotZ);
    this.bodyShift.y += shiftY * VOXEL_SIZE;
    this.bodyShift.z += shiftZ * VOXEL_SIZE;
  }

  private reset(): void {
    for (const { bone, rest } of this.byName.values()) {
      bone.position.copy(rest);
      bone.rotation.set(0, 0, 0);
    }
    this.bodyRot.set(0, 0, 0);
    this.bodyPivot.set(0, 0, 0);
    this.bodyShift.set(0, 0, 0);
  }

  private applyBody(): void {
    this.root.rotation.copy(this.bodyRot);
    tmpQ.setFromEuler(this.bodyRot);
    // Rotate around the pivot: p - R·p, then the shift.
    tmpV.copy(this.bodyPivot).applyQuaternion(tmpQ);
    this.root.position.copy(this.bodyPivot).sub(tmpV).add(this.bodyShift);
  }
}

/** Rig without extras: a head that looks and nods (snail). */
export class HeadRig extends AnimalRig {}
