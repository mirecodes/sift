import { defineModel } from './builder';

// Cat: orange tabby with pointed ears, white muzzle and a striped upright tail.
export const cat = defineModel([3, 6, 6], {
  1: ['body', '#E8993E'], // fur
  2: ['accent', '#B96A22'], // stripes
  3: ['muzzle', '#FFF3E0'], // muzzle, paws
  4: ['eye', '#1E1E1E'], // eye
  5: ['nose', '#F4A6B7'], // nose
}, (b) => {
  b.boxM(0, 0, 1, 1, 1, 1, 1); // hind legs
  b.boxM(0, 0, 4, 1, 1, 1, 3); // front paws
  b.box(0, 1, 1, 3, 2, 4, 1); // body
  b.box(0, 2, 1, 3, 1, 1, 2); // back stripes
  b.box(0, 2, 3, 3, 1, 1, 2);
  b.box(0, 2, 4, 3, 3, 2, 1); // head
  b.box(0, 2, 5, 3, 1, 1, 3); // muzzle
  b.set(1, 3, 5, 5); // nose
  b.setM(0, 4, 5, 4); // eyes
  b.boxM(0, 5, 4, 1, 1, 1, 1); // ears
  b.box(1, 1, 0, 1, 4, 1, 1); // tail
  b.set(1, 2, 0, 2);
  b.set(1, 4, 0, 2);
});
