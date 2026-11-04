import { defineModel } from '../../../tools/content-build/animal';

// Wolf: silver-grey, sitting tall with its muzzle raised to howl.
export default defineModel([3, 10, 6], {
  1: ['body', '#9AA3AE'], // fur
  2: ['belly', '#E6EAF0'], // chest, muzzle, tail tip
  3: ['eye', '#1E1E1E'], // eye, nose
  4: ['accent', '#5B6470'], // back, ears
}, (b) => {
  b.boxM(0, 0, 1, 1, 2, 1, 4); // hind legs
  b.boxM(0, 0, 4, 1, 2, 1, 4); // front legs
  b.box(0, 2, 1, 3, 3, 4, 1); // body
  b.box(0, 4, 1, 3, 1, 4, 4); // back
  b.box(0, 2, 4, 3, 2, 1, 2); // chest
  b.box(1, 1, 0, 1, 3, 1, 4); // tail
  b.set(1, 1, 0, 2); // tail tip
  b.box(0, 5, 3, 3, 2, 2, 1); // neck
  b.box(0, 5, 4, 3, 2, 1, 2); // throat
  b.box(0, 7, 3, 3, 2, 2, 1); // head
  b.box(1, 8, 5, 1, 2, 1, 2); // raised muzzle
  b.set(1, 9, 5, 3); // nose
  b.setM(0, 8, 4, 3); // eyes
  b.boxM(0, 9, 3, 1, 1, 1, 4); // ears
});
