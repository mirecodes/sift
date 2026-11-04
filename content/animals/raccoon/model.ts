import { defineModel } from '../../../tools/content-build/animal';

// Raccoon: grey body, dark eye mask, white brow and a striped tail.
export default defineModel([5, 5, 6], {
  1: ['body', '#8A8F98'], // fur
  2: ['accent', '#2B2B2B'], // mask, legs, tail stripes
  3: ['muzzle', '#EDEDED'], // brow, muzzle
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(1, 0, 2, 1, 1, 2, 2); // legs
  b.box(0, 1, 2, 5, 2, 2, 1); // body
  b.box(1, 3, 2, 3, 1, 2, 1); // back
  b.box(1, 1, 4, 3, 3, 2, 1); // head
  b.boxM(1, 4, 4, 1, 1, 1, 1); // ears
  b.box(1, 3, 5, 3, 1, 1, 3); // brow
  b.box(1, 1, 5, 3, 1, 1, 3); // muzzle
  b.box(1, 2, 5, 3, 1, 1, 2); // mask
  b.set(2, 1, 5, 2); // nose
  b.setM(1, 2, 5, 4); // eyes
  b.box(1, 1, 0, 3, 1, 2, 1); // tail rings
  b.box(1, 2, 0, 3, 1, 2, 2);
  b.box(1, 3, 0, 3, 1, 2, 1);
  b.box(1, 4, 0, 3, 1, 2, 2);
});
