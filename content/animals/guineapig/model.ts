import { defineModel } from '../../../tools/content-build/animal';

// Guinea pig: boxy cream body with orange patches, tiny ears, pink nose.
export default defineModel([4, 4, 6], {
  1: ['body', '#F7EFE2'], // coat
  2: ['accent', '#E8993E'], // patches
  3: ['eye', '#1E1E1E'], // eye
  4: ['nose', '#F4A6B7'], // nose, ears
}, (b) => {
  b.box(0, 0, 0, 4, 3, 6, 1); // body
  b.box(0, 2, 0, 2, 1, 3, 2); // back patch
  b.box(2, 1, 1, 2, 2, 2, 2); // side patch
  b.box(2, 2, 4, 2, 1, 2, 2); // head patch
  b.setM(0, 1, 5, 3); // eyes
  b.setM(1, 0, 5, 4); // nose
  b.boxM(0, 3, 4, 1, 1, 1, 4); // ears
});
