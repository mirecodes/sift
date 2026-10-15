import { tierName, type Tier, type TierRank } from '../config';

export interface AnimalSpecies {
  id: string;
  name: string;
  tierRank: TierRank;
  /** Stored label for `tierRank`; never compared in logic. */
  tier: Tier;
  /** Key into the voxel model registry (`src/assets/voxels`). */
  modelId: string;
  idleAnimation: 'default' | 'flop' | 'sparkle' | 'rainbow' | 'flutter';
  /** Tiles occupied, [x, z]. All species are 1×1 (ADR-005). */
  footprint: readonly [number, number];
}

const [COMMON, MYTHIC, EPIC, LEGENDARY] = [0, 1, 2, 3] as const;

const s = (
  id: string,
  name: string,
  tierRank: TierRank,
  idleAnimation: AnimalSpecies['idleAnimation'] = 'default',
): AnimalSpecies => ({ id, name, tierRank, tier: tierName(tierRank), modelId: id, idleAnimation, footprint: [1, 1] });

export const CATALOG: readonly AnimalSpecies[] = [
  // Common
  s('chick', 'Chick', COMMON),
  s('rabbit', 'Rabbit', COMMON),
  s('duck', 'Duck', COMMON),
  s('hamster', 'Hamster', COMMON),
  s('squirrel', 'Squirrel', COMMON),
  s('hedgehog', 'Hedgehog', COMMON),
  s('mouse', 'Mouse', COMMON),
  s('frog', 'Frog', COMMON),
  s('fish', 'Fish', COMMON, 'flop'),
  s('snail', 'Snail', COMMON),
  s('ladybug', 'Ladybug', COMMON),
  s('bee', 'Bee', COMMON),
  s('butterfly', 'Butterfly', COMMON, 'flutter'),
  s('beetle', 'Beetle', COMMON),
  s('turtle', 'Turtle', COMMON),
  s('crab', 'Crab', COMMON),
  s('starfish', 'Starfish', COMMON),
  s('mole', 'Mole', COMMON),
  s('sparrow', 'Sparrow', COMMON),
  s('pigeon', 'Pigeon', COMMON),
  s('hen', 'Hen', COMMON),
  s('guineapig', 'Guinea Pig', COMMON),
  s('lizard', 'Lizard', COMMON),
  s('bat', 'Bat', COMMON),
  s('ferret', 'Ferret', COMMON),
  // Mythic (second tier, blue)
  s('sheep', 'Sheep', MYTHIC),
  s('pig', 'Pig', MYTHIC),
  s('cat', 'Cat', MYTHIC),
  s('dog', 'Dog', MYTHIC),
  s('goat', 'Goat', MYTHIC),
  s('raccoon', 'Raccoon', MYTHIC),
  s('penguin', 'Penguin', MYTHIC),
  s('owl', 'Owl', MYTHIC),
  s('otter', 'Otter', MYTHIC),
  s('beaver', 'Beaver', MYTHIC),
  s('capybara', 'Capybara', MYTHIC),
  s('axolotl', 'Axolotl', MYTHIC),
  s('parrot', 'Parrot', MYTHIC),
  s('koala', 'Koala', MYTHIC),
  // Epic (third tier, pink)
  s('horse', 'Horse', EPIC),
  s('cow', 'Cow', EPIC),
  s('deer', 'Deer', EPIC),
  s('fox', 'Fox', EPIC),
  s('wolf', 'Wolf', EPIC),
  s('bear', 'Bear', EPIC),
  s('panda', 'Panda', EPIC),
  s('redpanda', 'Red Panda', EPIC),
  s('peacock', 'Peacock', EPIC),
  // Legendary, the top tier (every Legendary species has the sparkle effect; the unicorn adds rainbow bursts)
  s('unicorn', 'Unicorn', LEGENDARY, 'rainbow'),
  s('tiger', 'Tiger', LEGENDARY, 'sparkle'),
];

const BY_ID = new Map(CATALOG.map((a) => [a.id, a]));

export function getSpecies(id: string): AnimalSpecies {
  const species = BY_ID.get(id);
  if (!species) throw new Error(`Unknown animal species: ${id}`);
  return species;
}

export const speciesByRank = (rank: TierRank): AnimalSpecies[] => CATALOG.filter((a) => a.tierRank === rank);
