import { defineModel } from '../../../tools/content-build/animal';

// Butterfly (`flutter`): a slim body with a round head and two separate eyes, curled antennae and small,
// delicate flat wings (fore- and hindwing with a notch between), orange with dark tips and a pale dot.
// The wings are parts hinged at the body so they can flap (DESIGN.md 18).
const WING_ROWS: readonly (readonly [z: number, from: number])[] = [
  [4, 1], [3, 0], // forewing
  [2, 1], [1, 1], [0, 2], // hindwing
];
const ROOT = 3; // last wing column, next to the body

export default defineModel([9, 3, 6], {
  1: ['body', '#3A2A20'], // body
  2: ['wing', '#FF9A3C'], // wings
  3: ['accent', '#3A2A20'], // wing tips, antennae
  4: ['accent2', '#FFF3D6'], // dots
  5: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(4, 0, 0, 1, 2, 5, 1); // slim body
  b.box(3, 0, 5, 3, 2, 1, 1); // round head
  b.set(3, 1, 5, 5); // eyes, one on each side
  b.set(5, 1, 5, 5);
  b.set(3, 2, 5, 3); // antennae
  b.set(5, 2, 5, 3);
  b.pair('wing', [ROOT + 0.5, 1, 2], () => {
    for (const [z, from] of WING_ROWS) for (let x = from; x <= ROOT; x++) b.set(x, 1, z, 2);
    b.set(0, 1, 3, 3); // dark tips
    b.set(1, 1, 4, 3);
    b.set(1, 1, 3, 4); // pale dot
    b.set(2, 1, 1, 4);
  });
});
