import type { TierRank } from '../../../domain/config';
import type { RigBone } from '../../voxel/geometry';
import { HeadRig, type AnimalRig } from './AnimalRig';
import { BirdRig, OwlRig, PeacockRig, PenguinRig } from './birds';
import { BearRig, CanineRig, FelineRig, HoofedRig, QuadrupedRig, ReptileRig, SitterRig, TurtleRig } from './quadrupeds';
import { BeeRig, BeetleRig, CrabRig, FishRig, FlyerRig } from './small';

export { AnimalRig, type Motion, type RigFrame } from './AnimalRig';

type RigClass = new (spec: readonly RigBone[], rank: TierRank) => AnimalRig;

/**
 * Rig presets by id (ADR-055): `animal.json` `rig` picks one. `content/presets.json` lists the same ids
 * (kind `rig`); a test keeps them equal. A new rig is an app release.
 */
export const RIGS = {
  head: HeadRig,
  quadruped: QuadrupedRig,
  canine: CanineRig,
  feline: FelineRig,
  hoofed: HoofedRig,
  bear: BearRig,
  sitter: SitterRig,
  reptile: ReptileRig,
  turtle: TurtleRig,
  bird: BirdRig,
  owl: OwlRig,
  peacock: PeacockRig,
  penguin: PenguinRig,
  flyer: FlyerRig,
  bee: BeeRig,
  beetle: BeetleRig,
  fish: FishRig,
  crab: CrabRig,
} as const satisfies Record<string, RigClass>;

export type RigId = keyof typeof RIGS;

/** A rig for one animal, or null when its species has none (or an id this build does not know). */
export function createRig(id: string | undefined, spec: readonly RigBone[], rank: TierRank): AnimalRig | null {
  const Rig = id && Object.hasOwn(RIGS, id) ? RIGS[id as RigId] : undefined;
  return Rig ? new Rig(spec, rank) : null;
}
