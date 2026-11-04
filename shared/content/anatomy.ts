/**
 * Anatomy vocabulary for articulated animals (ADR-055). An animal model may split movable voxels into
 * parts named here; each part turns around its pivot and rides on its parent (`null` = the body).
 * Rigs (`src/world/animals/rigs/`) animate parts by these names. `L`/`R` = low-x / high-x side,
 * that is left / right as seen from the front.
 */
export const ANIMAL_PARTS = {
  head: null,
  earL: 'head',
  earR: 'head',
  tail: null,
  tail2: 'tail',
  legFL: null,
  legFR: null,
  legBL: null,
  legBR: null,
  legL: null,
  legR: null,
  wingL: null,
  wingR: null,
  finL: null,
  finR: null,
  clawL: null,
  clawR: null,
} as const satisfies Record<string, string | null>;

export type AnimalPartName = keyof typeof ANIMAL_PARTS;

export const isAnimalPart = (name: string): name is AnimalPartName => Object.hasOwn(ANIMAL_PARTS, name);

/** Parent part of `name`, or null when it hangs off the body. */
export const partParent = (name: AnimalPartName): AnimalPartName | null => ANIMAL_PARTS[name];

/** Part names ordered so every parent comes before its children (bone order). */
export function partOrder(names: readonly string[]): AnimalPartName[] {
  const known = names.filter(isAnimalPart);
  const depth = (n: AnimalPartName): number => {
    const p = partParent(n);
    return p && known.includes(p) ? 1 + depth(p) : 0;
  };
  return [...known].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
}
