import { defineModel } from '../../../tools/content-build/animal';

// Tiger: orange with black stripes, white muzzle and a 王-style mark on the forehead. Long body (8 deep).
export default defineModel([5, 12, 8], {
  1: ['body', '#F28C28'], // fur
  2: ['eye', '#1E1E1E'], // stripes, eyes, forehead mark
  3: ['belly', '#FFFFFF'], // muzzle, belly
  4: ['nose', '#F4A6B7'], // nose
}, (b) => {
  b.boxM(0, 0, 1, 2, 4, 2, 1); // hind legs
  b.boxM(0, 0, 5, 2, 4, 2, 1); // front legs
  b.boxM(0, 1, 1, 1, 1, 2, 2); // leg stripes
  b.boxM(0, 2, 5, 1, 1, 2, 2);
  b.box(0, 4, 1, 5, 4, 6, 1); // body
  b.box(2, 4, 1, 1, 1, 6, 3); // belly
  b.boxM(0, 5, 1, 1, 3, 1, 2); // body stripes
  b.boxM(0, 5, 3, 1, 3, 1, 2);
  b.boxM(0, 5, 5, 1, 3, 1, 2);
  b.box(0, 7, 1, 5, 1, 1, 2); // back stripes
  b.box(0, 7, 3, 5, 1, 1, 2);
  b.box(2, 5, 0, 1, 4, 1, 1); // tail
  b.set(2, 6, 0, 2);
  b.set(2, 8, 0, 2);
  b.box(0, 7, 5, 5, 4, 3, 1); // head
  b.box(1, 7, 7, 3, 2, 1, 3); // muzzle
  b.set(2, 8, 7, 4); // nose
  b.setM(1, 9, 7, 2); // eyes
  b.box(1, 10, 7, 3, 1, 1, 2); // forehead mark
  b.box(2, 10, 5, 1, 1, 3, 2);
  b.setM(0, 9, 6, 2); // cheek stripes
  b.boxM(0, 11, 5, 1, 1, 1, 1); // ears
});
