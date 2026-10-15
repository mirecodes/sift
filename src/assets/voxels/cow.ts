import { defineModel } from './builder';

// Cow: white with black patches, pink snout, small horns. Long body (8 deep).
export const cow = defineModel([5, 7, 8], {
  1: ['body', '#F7F7F2'], // coat
  2: ['accent', '#2B2B2B'], // patches, hooves
  3: ['nose', '#F4A6B7'], // snout
  4: ['horn', '#F3E6C4'], // horns
  5: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 0, 2, 3, 2, 1); // hind legs
  b.boxM(0, 0, 5, 2, 3, 2, 1); // front legs
  b.boxM(0, 0, 0, 2, 1, 2, 2); // hooves
  b.boxM(0, 0, 5, 2, 1, 2, 2);
  b.box(0, 3, 0, 5, 3, 7, 1); // body
  b.box(1, 3, 6, 3, 3, 2, 1); // head
  b.box(1, 3, 7, 3, 2, 1, 3); // snout
  b.setM(1, 6, 6, 4); // horns
  b.boxM(0, 5, 6, 1, 1, 1, 1); // ears
  b.setM(1, 5, 7, 5); // eyes
  b.box(2, 2, 0, 1, 3, 1, 1); // tail
  b.set(2, 2, 0, 2);
  b.box(4, 4, 1, 1, 2, 3, 2); // patches
  b.box(1, 5, 0, 2, 1, 4, 2);
  b.box(0, 3, 3, 1, 2, 3, 2);
});
