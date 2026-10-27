import { defineModel } from '../../../tools/content-build/animal';

// Panda: black and white, sitting and holding a bamboo stalk.
export default defineModel([5, 8, 6], {
  1: ['body', '#F7F7F7'], // fur
  2: ['eye', '#1E1E1E'], // arms, ears, eye patches, nose
  3: ['prop', '#7BC950'], // bamboo
  4: ['prop2', '#4E9A3A'], // bamboo leaves
}, (b) => {
  b.box(0, 0, 0, 5, 4, 4, 1); // body
  b.boxM(0, 0, 3, 2, 1, 2, 2); // feet
  b.boxM(0, 1, 0, 1, 3, 4, 2); // arm bands
  b.box(2, 0, 5, 1, 6, 1, 3); // bamboo
  b.boxM(1, 5, 5, 1, 1, 1, 4); // leaves
  b.boxM(1, 1, 4, 1, 2, 2, 2); // arms holding it
  b.box(0, 4, 0, 5, 3, 4, 1); // head
  b.boxM(0, 7, 1, 1, 1, 1, 2); // ears
  b.boxM(1, 5, 3, 1, 2, 1, 2); // eye patches
  b.set(2, 5, 4, 2); // nose
});
