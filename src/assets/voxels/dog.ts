import { defineModel } from './builder';

// Dog: light brown body, tan muzzle, floppy dark ears and a wagging tail.
export const dog = defineModel([5, 6, 6], {
  1: ['body', '#C9955C'], // fur
  2: ['muzzle', '#E6C39A'], // muzzle
  3: ['accent', '#7A5230'], // ears
  4: ['eye', '#1E1E1E'], // eye
  5: ['nose', '#2B2B2B'], // nose
}, (b) => {
  b.boxM(1, 0, 0, 1, 2, 1, 1); // hind legs
  b.boxM(1, 0, 3, 1, 2, 1, 1); // front legs
  b.box(1, 2, 0, 3, 2, 4, 1); // body
  b.box(2, 4, 0, 1, 2, 1, 1); // tail
  b.box(1, 3, 4, 3, 3, 2, 1); // head
  b.box(1, 3, 5, 3, 1, 1, 2); // muzzle
  b.set(2, 4, 5, 5); // nose
  b.setM(1, 5, 5, 4); // eyes
  b.boxM(0, 3, 4, 1, 3, 1, 3); // floppy ears
});
