import { defineModel } from '../../../tools/content-build/animal';

// Deer: tan body with white belly and spots, long legs, branching antlers.
export default defineModel([3, 10, 6], {
  1: ['body', '#B9824F'], // coat
  2: ['belly', '#FFFFFF'], // belly, spots, tail
  3: ['horn', '#6B4A2B'], // antlers
  4: ['eye', '#1E1E1E'], // eye
  5: ['nose', '#3A2A20'], // nose
}, (b) => {
  b.boxM(0, 0, 1, 1, 4, 1, 1); // hind legs
  b.boxM(0, 0, 4, 1, 4, 1, 1); // front legs
  b.box(0, 4, 1, 3, 2, 4, 1); // body
  b.box(0, 4, 2, 3, 1, 2, 2); // belly
  b.box(0, 6, 4, 3, 2, 2, 1); // head
  b.boxM(0, 7, 3, 1, 1, 1, 1); // ears
  b.boxM(0, 8, 4, 1, 2, 1, 3); // antlers
  b.setM(0, 9, 3, 3);
  b.setM(0, 9, 5, 3);
  b.set(1, 6, 5, 5); // nose
  b.setM(0, 7, 5, 4); // eyes
  b.set(1, 5, 0, 2); // tail
  b.set(0, 5, 3, 2); // spots
  b.set(2, 5, 2, 2);
  b.set(1, 5, 1, 2);
});
