import { defineModel } from '../../../tools/content-build/animal';

// Horse: chestnut body, long legs, dark mane, tail and hooves. Long body (8 deep).
export default defineModel([3, 9, 8], {
  1: ['body', '#A0522D'], // coat
  2: ['mane', '#3B2416'], // mane, tail, hooves
  3: ['eye', '#1E1E1E'], // eye
  4: ['muzzle', '#C97A4A'], // muzzle
}, (b) => {
  b.boxM(0, 0, 1, 1, 3, 1, 1); // hind legs
  b.boxM(0, 0, 6, 1, 3, 1, 1); // front legs
  b.boxM(0, 0, 1, 1, 1, 1, 2); // hooves
  b.boxM(0, 0, 6, 1, 1, 1, 2);
  b.box(0, 3, 1, 3, 3, 6, 1); // body
  b.box(0, 5, 6, 3, 3, 2, 1); // neck and head
  b.box(0, 5, 7, 3, 1, 1, 4); // muzzle
  b.box(1, 6, 5, 1, 3, 1, 2); // mane
  b.set(1, 8, 6, 2); // forelock
  b.boxM(0, 8, 6, 1, 1, 1, 1); // ears
  b.setM(0, 7, 7, 3); // eyes
  b.box(1, 2, 0, 1, 4, 1, 2); // tail
});
