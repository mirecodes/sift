import { defineModel } from '../../../tools/content-build/animal';

// Butterfly (`flutter`): a slim dark body with large flat wings spread in the horizontal plane, monarch
// style: orange panes, black border and veins, white dots on the border. The wings are parts hinged at
// the body so they can flap (DESIGN.md 18).
const WING_ROWS: readonly (readonly [z: number, from: number])[] = [
  [7, 2], [6, 0], [5, 0], [4, 0], [3, 1], // forewing, front
  [2, 1], [1, 2], [0, 3], // hindwing, back
];
const ROOT = 5; // last wing column, next to the body

export default defineModel([14, 3, 8], {
  1: ['body', '#3A2A20'], // body
  2: ['wing', '#FF8A1F'], // wing panes
  3: ['accent', '#26201C'], // border, veins, antennae
  4: ['accent2', '#FFF6E0'], // dots
  5: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(6, 0, 1, 2, 2, 6, 1); // body
  b.box(6, 0, 7, 2, 2, 1, 1); // head
  b.set(6, 1, 7, 5);
  b.set(7, 1, 7, 5);
  b.set(6, 2, 7, 3); // antennae
  b.set(7, 2, 7, 3);
  b.pair('wing', [ROOT + 0.5, 1, 3.5], () => {
    for (const [z, from] of WING_ROWS) {
      for (let x = from; x <= ROOT; x++) {
        const edge = x === from || z === 7 || z === 0 || (z === 6 && x < 2) || (z === 1 && x < 3);
        const vein = z === 3 && x < ROOT; // between fore- and hindwing
        const ray = x === 3 && z >= 4 && z <= 6; // forewing vein
        const color = edge ? ((x + z) % 2 === 0 && x < ROOT - 1 ? 4 : 3) : vein || ray ? 3 : 2;
        b.set(x, 1, z, color);
      }
    }
  });
});
